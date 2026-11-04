import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { getPayload, type Migration, type Payload } from 'payload';
import { expect, it, vi } from 'vitest';
import { assertUnlinkedWorkspacePath } from './next-dist';
import { migrations } from '../migrations';
import {
  publicRootSchema,
  readPublicRoot,
  withPublicRootWriter,
} from '../helpers/payload/public-root';
import { publicRootDirectory } from '../helpers/payload/public-root-directory';
import { inspectOwnedTestDatabase } from '../../testing/setup/owned-test-database';
import { isolatedTestDatabaseUri } from '../../testing/setup/test-environment';
import { runBackupTool } from '../../ops/backup/tools';
import {
  createLocalBackupRepository,
  localBackupRepositoryDirectory,
  withPrivateBackupWorkspace,
} from '../../ops/backup/repository';
import { decryptBackupArchive } from '../../ops/backup/age';
import { extractValidatedBackupArchive } from '../../ops/backup/archive';
import { planControlledMigration, runControlledMigration } from '../../ops/migrations/controlled';

const toolsConfigPath = process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG;
const native = toolsConfigPath ? it : it.skip;
type ToolConfig = { ageBinary: string; tarBinary: string; identityPath: string; recipient: string };
type Client = { release: () => void };
type Pool = Payload['db']['pool'] & { _clients: Client[]; _idle: { client: Client }[] };

async function closeOwnPayload(payload: Payload) {
  const pool = payload.db.pool as Pool | undefined;
  if (!pool) return payload.destroy();
  const checkout = () =>
    pool._clients.filter((client) => !pool._idle.some((entry) => entry.client === client));
  const [bootstrap, ...other] = checkout();
  if (
    !bootstrap ||
    other.length ||
    pool.waitingCount ||
    Object.keys(payload.db.sessions ?? {}).length
  )
    throw new Error('The owned Payload pool has activity beyond its Native bootstrap checkout.');
  await payload.destroy();
  if (
    payload.db.pool !== pool ||
    checkout().length !== 1 ||
    checkout()[0] !== bootstrap ||
    pool.waitingCount ||
    Object.keys(payload.db.sessions ?? {}).length
  )
    throw new Error('The owned Payload pool changed before its bootstrap checkout release.');
  bootstrap.release();
  await pool.end();
}

native(
  'backs up the real predecessor, refuses a competing job and applies the reviewed Native up once',
  async () => {
    const tools = JSON.parse(await readFile(toolsConfigPath!, 'utf8')) as ToolConfig;
    const owned = inspectOwnedTestDatabase();
    const runId = process.env.ADFL_TEST_RUN_ID!;
    const id = randomUUID().replaceAll('-', '');
    const database = `adfl_test_migration_${id}`;
    const recoveryDatabase = `adfl_test_migration_restore_${id}`;
    const uri = new URL(isolatedTestDatabaseUri);
    uri.pathname = `/${database}`;
    const siteOrigin = 'http://127.0.0.1:3106';
    const publication = publicRootDirectory({
      APP_ENV: 'test',
      SITE_ORIGIN: siteOrigin,
      DATABASE_URI: uri.href,
    });
    const recoveryUri = new URL(uri.href);
    recoveryUri.pathname = `/${recoveryDatabase}`;
    const recoveryPublication = publicRootDirectory({
      APP_ENV: 'test',
      SITE_ORIGIN: siteOrigin,
      DATABASE_URI: recoveryUri.href,
    });
    const namespace = {
      project: 'a-design-for-life',
      environment: 'test',
      source: `migration-${id}`,
    } as const;
    const source = path.resolve('.work/private-media', `adfl-test-migration-${id}`);
    const docker = (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((directory) =>
        path.resolve(directory, process.platform === 'win32' ? 'docker.exe' : 'docker'),
      )
      .find((candidate) => existsSync(candidate));
    if (!docker) throw new Error('Missing Docker tool for the isolated Native proof.');
    const assertOwned = () => {
      const current = inspectOwnedTestDatabase();
      if (
        current.containerId !== owned.containerId ||
        current.networkId !== owned.networkId ||
        process.env.ADFL_TEST_RUN_ID !== runId
      )
        throw new Error('The Native proof lost its acquired test resources.');
      return { containerId: current.containerId, networkId: current.networkId, runId };
    };
    async function invoke(input: {
      tool: 'createdb' | 'dropdb' | 'pg_dump' | 'pg_restore' | 'psql';
      args: readonly string[];
      inputFile?: string;
      outputFile?: string;
    }) {
      assertOwned();
      const result = await runBackupTool({
        binary: docker!,
        args: [
          'exec',
          ...(input.inputFile ? ['--interactive'] : []),
          owned.containerId,
          input.tool,
          ...input.args,
        ],
        inputFile: input.inputFile,
        outputFile: input.outputFile,
      });
      return result.stdout;
    }
    const payloads: Payload[] = [];
    const previous = migrations.slice(0, -1);
    const schema = createHash('sha256');
    for (const { name } of previous) {
      for (const extension of ['ts', 'json']) {
        const file = `src/migrations/${name}.${extension}`;
        schema
          .update(file + '\0')
          .update(await readFile(file))
          .update('\0');
      }
    }
    const application = {
      revision: '60314d2a095b178f16ddc3972e384d153ba031b5',
      schemaSha256: schema.digest('hex'),
    };
    async function initialize(databaseUri = uri.href) {
      const config = await (await import('../payload.config')).default;
      const payload = await getPayload({
        config: {
          ...config,
          db: {
            name: 'postgres',
            allowIDOnCreate: false,
            ...postgresAdapter({
              pool: { connectionString: databaseUri },
              idType: 'uuid',
              push: false,
              disableCreateDatabase: true,
            }),
          },
          collections: config.collections.filter(({ slug }) => slug !== 'publication-retries'),
          typescript: { ...config.typescript, autoGenerate: false },
        },
        disableDBConnect: true,
        disableOnInit: true,
        key: `controlled-proof-${id}-${payloads.length}`,
      });
      payloads.push(payload);
      return payload;
    }
    const history = async (payload: Payload) =>
      (await payload.find({ collection: 'payload-migrations', limit: 0, overrideAccess: true }))
        .docs;
    const configuration = {
      databaseUri: uri.href,
      siteOrigin,
      assertOwned(selected: string) {
        if (selected !== database)
          throw new Error('Controlled migration requested a different owned database.');
        assertOwned();
      },
      initialize: () => initialize(),
      backup: {
        application,
        recipient: tools.recipient,
        tools,
        async dump({ snapshotId, destination }: { snapshotId: string; destination: string }) {
          await invoke({
            tool: 'pg_dump',
            args: [
              '--username=adfl_test',
              `--dbname=${database}`,
              '--format=custom',
              `--snapshot=${snapshotId}`,
              '--no-owner',
              '--no-acl',
            ],
            outputFile: destination,
          });
        },
      },
    };
    let created = false;
    let recoveryCreated = false;
    try {
      vi.stubEnv('PUBLICATION_RETRIES_ENABLED', 'false');
      await invoke({ tool: 'createdb', args: ['--username=adfl_test', database] });
      created = true;
      const old = await initialize();
      await old.db.connect!();
      // Payload's generic type uses unknown arguments. This owned test invokes
      // the real Postgres adapter with the preceding Native Postgres catalog.
      await old.db.migrate({ migrations: previous as Migration[] });
      const predecessor = await history(old);
      expect(predecessor).toHaveLength(15);
      const record = await old.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: `migration-${id}@example.invalid`,
          password: 'Synthetic-migration-test-only-987!',
        },
        context: { trustedAccountProvisioning: true },
      });
      const root = { generation: randomUUID(), subjects: {} };
      await withPublicRootWriter(publication, (_current, commit) => commit(root));

      await expect(
        runControlledMigration({
          ...configuration,
          backup: {
            ...configuration.backup,
            dump: async () => {
              throw new Error('Controlled synthetic dump failure');
            },
          },
        }),
      ).rejects.toThrow(/synthetic dump failure/i);
      expect(await history(old)).toEqual(predecessor);

      let overlappingJobRejected = false;
      const result = await runControlledMigration({
        ...configuration,
        backup: {
          ...configuration.backup,
          async dump(input) {
            await expect(runControlledMigration(configuration)).rejects.toThrow(/busy/i);
            overlappingJobRejected = true;
            expect(await history(old)).toEqual(predecessor);
            return configuration.backup.dump(input);
          },
        },
      });
      expect(overlappingJobRejected).toBe(true);
      expect(result.status).toBe('applied');
      if (result.status !== 'applied')
        throw new Error('Expected the controlled Native migration to apply.');
      expect(result.backup.complete).toBe(true);
      expect((await history(old)).map(({ name }) => name)).toContain(
        '20261104_012603_publication_retry_metadata',
      );
      expect(await history(old)).toHaveLength(16);
      expect(
        await old.findByID({ collection: 'users', id: record.id, overrideAccess: true }),
      ).toMatchObject({ id: record.id });
      expect(await readPublicRoot(publication)).toEqual(root);
      await expect(
        runControlledMigration({
          ...configuration,
          backup: {
            ...configuration.backup,
            dump: async () => {
              throw new Error('Already-current jobs must not create a backup');
            },
          },
        }),
      ).resolves.toEqual({ status: 'already-current' });

      const repository = await createLocalBackupRepository({ namespace });
      await withPrivateBackupWorkspace('restore', async (directory) => {
        const ciphertext = path.join(directory, 'payload.age');
        expect(await repository.stageCompletedSet(result.backup.id, ciphertext)).toEqual(
          result.backup,
        );
        const decrypted = await decryptBackupArchive({
          sourcePath: ciphertext,
          destination: path.join(directory, 'payload.tar'),
          identityPath: tools.identityPath,
          ageBinary: tools.ageBinary,
        });
        const archive = await extractValidatedBackupArchive({
          archivePath: decrypted.path,
          destination: path.join(directory, 'validated'),
        });
        const dump = archive.entries.find((entry) => entry.name === 'database.dump');
        const publicRoot = archive.entries.find(
          (entry) => entry.name === 'publication/current.json',
        );
        if (!dump || !publicRoot)
          throw new Error('Recovery fixture is missing the verified dump or public root.');
        const restoredRoot = publicRootSchema.parse(
          JSON.parse(await readFile(publicRoot.path, 'utf8')),
        );
        await invoke({ tool: 'createdb', args: ['--username=adfl_test', recoveryDatabase] });
        recoveryCreated = true;
        await invoke({
          tool: 'pg_restore',
          args: [
            '--username=adfl_test',
            `--dbname=${recoveryDatabase}`,
            '--single-transaction',
            '--no-owner',
            '--no-acl',
          ],
          inputFile: dump.path,
        });
        const recovery = await initialize(recoveryUri.href);
        await recovery.db.connect!();
        expect(planControlledMigration(await history(recovery))).toBe('pending');
        expect(
          await recovery.findByID({ collection: 'users', id: record.id, overrideAccess: true }),
        ).toMatchObject({ id: record.id });
        await withPublicRootWriter(recoveryPublication, (_current, commit) => commit(restoredRoot));
        expect(await readPublicRoot(recoveryPublication)).toEqual(root);
      });
      process.stdout.write(
        JSON.stringify({
          runId,
          database,
          databaseContainerId: owned.containerId,
          databaseNetworkId: owned.networkId,
          backupId: result.backup.id,
          ciphertextSha256: result.backup.ciphertext.sha256,
          schemaSha256: application.schemaSha256,
          predecessorRows: 15,
          currentRows: 16,
          competingJobRefused: true,
          preMigrationRestoreVerified: true,
        }) + '\n',
      );
    } finally {
      vi.unstubAllEnvs();
      assertOwned();
      for (const payload of payloads.reverse()) await closeOwnPayload(payload);
      if (recoveryCreated)
        await invoke({ tool: 'dropdb', args: ['--username=adfl_test', recoveryDatabase] });
      if (created) await invoke({ tool: 'dropdb', args: ['--username=adfl_test', database] });
      for (const directory of [
        source,
        publication,
        recoveryPublication,
        localBackupRepositoryDirectory(namespace),
      ]) {
        if (
          !(await lstat(directory).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          }))
        )
          continue;
        assertUnlinkedWorkspacePath(directory);
        await rm(directory, { recursive: true });
      }
    }
  },
  120_000,
);
