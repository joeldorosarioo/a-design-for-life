import type { PublicRoot } from '../../src/helpers/payload/public-root';
import type { StoredObject } from '../../src/helpers/storage/object-storage';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';
import { publicRootSchema, withPublicRootWriter } from '../../src/helpers/payload/public-root';
import { withPublicationWriter } from '../../src/helpers/payload/publication-writer';
import { createLocalRestoreObjectWriter } from '../../src/helpers/storage/restore-object';
import { checkedClock } from './contracts';
import { assertLocalDatabase, localDatabaseName } from '../../src/config/local-database';
import { assertPrivateBackupWorkPath, inspectPrivateBackupFile } from './repository';
const identity = z.string().regex(/^[a-f0-9]{64}$/);
const destination = z.strictObject({ identity, namespace: z.string() });
const targetSchema = z
  .strictObject({
    environment: z.literal('test'),
    ownerId: z.uuid(),
    database: destination,
    media: destination,
    publication: destination,
  })
  .superRefine((target, context) => {
    if (
      target.database.namespace !== localDatabaseName ||
      target.media.namespace !== `adfl-test-restore-${target.ownerId}` ||
      target.publication.namespace !== `adfl-restore-${target.ownerId}` ||
      new Set([target.database.identity, target.media.identity, target.publication.identity])
        .size !== 3
    )
      context.addIssue({
        code: 'custom',
        message: 'Restore requires the shared local database and private filesystem destinations',
      });
  });
const timestamp = z.iso.datetime({ precision: 3 });
const observationSchema = z.strictObject({
  target: targetSchema,
  checkpointedAt: timestamp,
  acquiredAt: timestamp,
  observedAt: timestamp,
  expiresAt: timestamp,
  preparedByOwner: z.literal(true),
  leaseActive: z.literal(true),
  databaseEmpty: z.literal(true),
  mediaEmpty: z.literal(true),
  publicationEmpty: z.literal(true),
});
type IsolatedRestoreTarget = z.infer<typeof targetSchema>;
type RestoreTargetObservation = z.infer<typeof observationSchema>;
declare const restorePermitBrand: unique symbol;
type RestoreTargetPermit = { readonly [restorePermitBrand]: true };

// The composition supplies the trusted resource-lifecycle inspector. It must
// inspect immutable identities, a recoverable checkpoint, emptiness and lease;
// never construct this observation from user-supplied names or verified flags.
export function createRestoreTargetBoundary(
  inspect: (target: IsolatedRestoreTarget) => Promise<unknown>,
) {
  const permits = new WeakMap<
    object,
    { observation: RestoreTargetObservation; issuedAt: number }
  >();
  async function observe(target: IsolatedRestoreTarget, now: number) {
    const observation = observationSchema.parse(await inspect(structuredClone(target)));
    const acquired = Date.parse(observation.acquiredAt);
    const checkpointed = Date.parse(observation.checkpointedAt);
    const checked = Date.parse(observation.observedAt);
    const expires = Date.parse(observation.expiresAt);
    if (
      JSON.stringify(observation.target) !== JSON.stringify(target) ||
      checkpointed > acquired ||
      acquired - checkpointed > 60_000 ||
      checked < acquired ||
      acquired > now ||
      now - acquired > 60_000 ||
      checked > now ||
      now - checked > 5_000 ||
      expires <= now ||
      expires - acquired > 300_000
    )
      throw new Error('Restore target ownership is stale or differs from the acquired resources');
    return observation;
  }
  return {
    async acquire(input: unknown, now: Date): Promise<RestoreTargetPermit> {
      const time = checkedClock(now);
      const target = targetSchema.parse(input);
      const observation = await observe(target, time);
      const permit = Object.freeze({}) as RestoreTargetPermit;
      permits.set(permit, { observation, issuedAt: time });
      return permit;
    },
    async run<T>(
      permit: unknown,
      now: Date,
      effect: (target: IsolatedRestoreTarget) => Promise<T>,
    ): Promise<T> {
      const time = checkedClock(now);
      const acquired = permit && typeof permit === 'object' ? permits.get(permit) : undefined;
      if (!acquired || time < acquired.issuedAt || time - acquired.issuedAt > 60_000)
        throw new Error('Restore requires an unconsumed fresh owned target permit');
      permits.delete(permit as object);
      const observed = await observe(acquired.observation.target, time);
      if (
        observed.acquiredAt !== acquired.observation.acquiredAt ||
        observed.checkpointedAt !== acquired.observation.checkpointedAt ||
        observed.expiresAt !== acquired.observation.expiresAt
      )
        throw new Error('The acquired restore target was replaced');
      return effect(structuredClone(observed.target));
    },
  };
}

export type OwnedPostgresBoundary = {
  assertOwned: () => Promise<{ containerId: string; networkId: string; runId: string }>;
  checkpoint: () => Promise<() => Promise<void>>;
  reset: () => Promise<void>;
  invoke: (input: {
    tool: 'psql' | 'pg_restore';
    args: readonly string[];
    inputFile?: string;
  }) => Promise<string>;
};
export type LocalRestoreContext = {
  databaseName: string;
  databaseUri: string;
  mediaRoot: string;
  mediaBucket: string;
  publicationDirectory: string;
  siteOrigin: string;
  ownerId: string;
};
export type LocalRestoreTargetOptions = {
  environment: 'test';
  sourceDatabaseUri: string;
  siteOrigin: string;
  postgres: OwnedPostgresBoundary;
  now?: () => Date;
};
declare const brand: unique symbol;
export type OwnedLocalRestoreTarget = { readonly [brand]: true };
const hostSchema = z.strictObject({
  containerId: z.string().regex(/^[a-f0-9]{64}$/),
  networkId: z.string().regex(/^[a-f0-9]{64}$/),
  runId: z.uuid(),
});
type Host = z.infer<typeof hostSchema>;
type ActualObservation = Omit<
  RestoreTargetObservation,
  'databaseEmpty' | 'mediaEmpty' | 'publicationEmpty' | 'leaseActive'
> & {
  databaseEmpty: boolean;
  mediaEmpty: boolean;
  publicationEmpty: boolean;
  leaseActive: boolean;
};
type State = {
  context: LocalRestoreContext;
  descriptor: IsolatedRestoreTarget;
  boundary: ReturnType<typeof createRestoreTargetBoundary>;
  assertOwned: () => Promise<void>;
  observe: () => Promise<ActualObservation>;
  setObservation: (value: ActualObservation) => void;
  clock: () => Date;
  writer: Awaited<ReturnType<typeof createLocalRestoreObjectWriter>>;
  invoke: (input: Parameters<OwnedPostgresBoundary['invoke']>[0]) => Promise<string>;
};
const targets = new WeakMap<object, State>();
const sameHost = (first: Host, second: Host) =>
  first.containerId === second.containerId &&
  first.networkId === second.networkId &&
  first.runId === second.runId;
async function directoryIdentity(directory: string) {
  assertUnlinkedWorkspacePath(directory);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('Owned restore directory unavailable');
  const canonical = await realpath(directory);
  return createHash('sha256')
    .update(JSON.stringify([canonical, info.dev, info.ino, info.birthtimeMs]))
    .digest('hex');
}
async function absent(directory: string) {
  assertUnlinkedWorkspacePath(directory);
  const info = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (info) throw new Error('Restore refuses pre-existing filesystem targets');
}
export function validateLocalRestoreTargetOptions(options: LocalRestoreTargetOptions) {
  if (
    options.environment !== 'test' ||
    !URL.canParse(options.sourceDatabaseUri) ||
    !URL.canParse(options.siteOrigin)
  )
    throw new Error('Only an unambiguous local test restore is available');
  const database = new URL(options.sourceDatabaseUri);
  const origin = new URL(options.siteOrigin);
  assertLocalDatabase(options.sourceDatabaseUri);
  if (
    origin.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(origin.hostname) ||
    origin.pathname !== '/' ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash
  )
    throw new Error('Only an owned local test restore namespace is available');
  return { database, origin };
}
export async function withOwnedLocalRestoreTarget<T>(
  options: LocalRestoreTargetOptions,
  operation: (target: OwnedLocalRestoreTarget) => Promise<T>,
): Promise<T> {
  const { database, origin } = validateLocalRestoreTargetOptions(options);
  const host = hostSchema.parse(await options.postgres.assertOwned());
  return withPublicationWriter(`backup-local-restore:${host.containerId}`, async () => {
    let active = true;
    const ownerId = randomUUID();
    const name = decodeURIComponent(database.pathname.slice(1));
    const bucket = `adfl-test-restore-${ownerId}`;
    const context: LocalRestoreContext = {
      databaseName: name,
      databaseUri: database.toString(),
      mediaBucket: bucket,
      mediaRoot: path.resolve('.work/private-media', bucket, name),
      publicationDirectory: path.resolve('.work/publication', `adfl-restore-${ownerId}`),
      siteOrigin: origin.origin,
      ownerId,
    };
    const clock = options.now ?? (() => new Date());
    const iso = () => new Date(checkedClock(clock())).toISOString();
    let restoreCheckpoint: (() => Promise<void>) | undefined;
    let oid: string | undefined;
    let mediaIdentity: string | undefined;
    let publicationIdentity: string | undefined;
    let token: OwnedLocalRestoreTarget | undefined;
    let failure: unknown;
    async function ownership() {
      if (!active || !sameHost(hostSchema.parse(await options.postgres.assertOwned()), host))
        throw new Error('Owned restore lifecycle lease or host changed');
    }
    async function invoke(input: Parameters<OwnedPostgresBoundary['invoke']>[0]) {
      await ownership();
      return (await options.postgres.invoke(input)).trim();
    }
    async function catalogOid() {
      return invoke({
        tool: 'psql',
        args: [
          `--username=${decodeURIComponent(database.username)}`,
          `--dbname=${name}`,
          '--no-align',
          '--tuples-only',
          '--set=ON_ERROR_STOP=1',
          '--command',
          `SELECT oid FROM pg_database WHERE datname = '${name}'`,
        ],
      });
    }
    try {
      await ownership();
      await absent(path.dirname(context.mediaRoot));
      await absent(context.publicationDirectory);
      oid = await catalogOid();
      if (!/^[1-9][0-9]*$/.test(oid))
        throw new Error('Shared local database catalog identity unavailable');
      restoreCheckpoint = await options.postgres.checkpoint();
      const checkpointedAt = iso();
      await options.postgres.reset();
      const writer = await createLocalRestoreObjectWriter({ root: context.mediaRoot, ownerId });
      mediaIdentity = await directoryIdentity(context.mediaRoot);
      assertUnlinkedWorkspacePath(context.publicationDirectory);
      await mkdir(path.dirname(context.publicationDirectory), { recursive: true, mode: 0o700 });
      await mkdir(context.publicationDirectory, { mode: 0o700 });
      publicationIdentity = await directoryIdentity(context.publicationDirectory);
      const acquiredAt = iso();
      const expiresAt = new Date(Date.parse(acquiredAt) + 300_000).toISOString();
      const databaseIdentity = createHash('sha256')
        .update(JSON.stringify([host.containerId, oid, name]))
        .digest('hex');
      const descriptor: IsolatedRestoreTarget = {
        environment: 'test',
        ownerId,
        database: { identity: databaseIdentity, namespace: name },
        media: { identity: mediaIdentity, namespace: bucket },
        publication: { identity: publicationIdentity, namespace: `adfl-restore-${ownerId}` },
      };
      async function assertTargetOwned(): Promise<void> {
        await ownership();
        if (
          !restoreCheckpoint ||
          !oid ||
          (await catalogOid()) !== oid ||
          (await directoryIdentity(context.mediaRoot)) !== mediaIdentity ||
          (await directoryIdentity(context.publicationDirectory)) !== publicationIdentity
        )
          throw new Error('Acquired restore target identity changed');
      }
      async function observe(): Promise<ActualObservation> {
        await assertTargetOwned();
        const count = await invoke({
          tool: 'psql',
          args: [
            `--username=${decodeURIComponent(database.username)}`,
            '--dbname=' + name,
            '--no-align',
            '--tuples-only',
            '--set=ON_ERROR_STOP=1',
            '--command',
            "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')",
          ],
        });
        return {
          target: structuredClone(descriptor),
          checkpointedAt,
          acquiredAt,
          observedAt: iso(),
          expiresAt,
          preparedByOwner: true,
          leaseActive: active,
          databaseEmpty: count === '0',
          mediaEmpty: (await readdir(context.mediaRoot)).length === 0,
          publicationEmpty: (await readdir(context.publicationDirectory)).length === 0,
        };
      }
      let observation = await observe();
      const boundary = createRestoreTargetBoundary(async () => structuredClone(observation));
      token = Object.freeze({}) as OwnedLocalRestoreTarget;
      targets.set(token, {
        context,
        descriptor,
        boundary,
        assertOwned: assertTargetOwned,
        observe,
        setObservation: (value) => {
          observation = value;
        },
        clock,
        writer,
        invoke,
      });
      return await operation(token);
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      if (token) targets.delete(token);
      try {
        if (restoreCheckpoint) {
          await ownership();
          if (!oid || (await catalogOid()) !== oid)
            throw new Error('Restore database identity changed; cleanup refused');
          if (
            (mediaIdentity && (await directoryIdentity(context.mediaRoot)) !== mediaIdentity) ||
            (publicationIdentity &&
              (await directoryIdentity(context.publicationDirectory)) !== publicationIdentity)
          )
            throw new Error('Restore directory identity changed; cleanup refused');
          await restoreCheckpoint();
          if (mediaIdentity) {
            const parent = path.dirname(context.mediaRoot);
            if (
              path.dirname(parent) !== path.resolve('.work/private-media') ||
              path.basename(parent) !== bucket
            )
              throw new Error('Unsafe media cleanup refused');
            assertUnlinkedWorkspacePath(parent);
            await rm(parent, { recursive: true });
          }
          if (publicationIdentity) {
            if (path.dirname(context.publicationDirectory) !== path.resolve('.work/publication'))
              throw new Error('Unsafe publication cleanup refused');
            assertUnlinkedWorkspacePath(context.publicationDirectory);
            await rm(context.publicationDirectory, { recursive: true });
          }
        }
      } catch (cleanupError) {
        if (failure !== undefined)
          throw new AggregateError(
            [failure, cleanupError],
            'Restore failed; changed targets were left for review',
          );
        throw cleanupError;
      } finally {
        active = false;
      }
    }
  });
}
function state(target: OwnedLocalRestoreTarget) {
  const acquired = targets.get(target);
  if (!acquired) throw new Error('An active acquired local restore target is required');
  return acquired;
}
export async function inspectOwnedLocalRestoreContext(
  target: OwnedLocalRestoreTarget,
): Promise<LocalRestoreContext> {
  const acquired = state(target);
  await acquired.assertOwned();
  return structuredClone(acquired.context);
}
export async function restoreIntoOwnedLocalTarget(
  target: OwnedLocalRestoreTarget,
  input: {
    dumpPath: string;
    objects: readonly { reference: StoredObject; path: string }[];
    root: PublicRoot | null;
    verifyRestored: (context: LocalRestoreContext) => Promise<void>;
  },
): Promise<void> {
  const acquired = state(target);
  // Read real catalog/filesystem state before passing its completed observation
  // to the clock-controlled guard; asynchronous I/O must not create a false
  // future timestamp relative to the guard's supplied clock.
  acquired.setObservation(await acquired.observe());
  const permit = await acquired.boundary.acquire(acquired.descriptor, acquired.clock());
  acquired.setObservation(await acquired.observe());
  await acquired.boundary.run(permit, acquired.clock(), async () => {
    assertPrivateBackupWorkPath(input.dumpPath);
    await inspectPrivateBackupFile(input.dumpPath);
    for (const object of input.objects) {
      assertPrivateBackupWorkPath(object.path);
      await acquired.writer.restore(object.reference, await readFile(object.path));
    }
    await acquired.invoke({
      tool: 'pg_restore',
      args: [
        `--username=${decodeURIComponent(new URL(acquired.context.databaseUri).username)}`,
        `--dbname=${acquired.context.databaseName}`,
        '--single-transaction',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
      ],
      inputFile: input.dumpPath,
    });
    if (input.root !== null) {
      const root = publicRootSchema.parse(input.root);
      await withPublicRootWriter(acquired.context.publicationDirectory, async (current, commit) => {
        if (current !== null) throw new Error('Restore publication target is not empty');
        await commit(root);
      });
    }
    await input.verifyRestored(await inspectOwnedLocalRestoreContext(target));
  });
}
