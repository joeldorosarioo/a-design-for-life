import { z } from 'zod';
import { checkedClock } from './contracts';
import { localDatabaseName } from '../../src/config/local-database';

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
export type IsolatedRestoreTarget = z.infer<typeof targetSchema>;
export type RestoreTargetObservation = z.infer<typeof observationSchema>;
declare const restorePermitBrand: unique symbol;
export type RestoreTargetPermit = { readonly [restorePermitBrand]: true };

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
