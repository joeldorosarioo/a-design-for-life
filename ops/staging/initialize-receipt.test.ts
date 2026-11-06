import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { mergeInitializationReceipt, validInitializationReceipt } from './initialize.cli.mjs';
import { stagingSeedSettings } from './seed-http.mjs';

const selected = { database: 'portfolio_stage', origin: 'https://staging.example.invalid' };
const base = {
  version: 1,
  environment: 'staging',
  ...selected,
  migrations: 16,
  migrationLedgerSha256: 'a'.repeat(64),
  completedAt: '2026-11-05T00:00:00.000Z',
};
const pending = () => ({
  ...base,
  status: 'pending-first-access',
  editorId: null,
  structuralDocuments: 0,
  structural: [],
  freshProvisioning: false,
});
const complete = () => ({
  ...base,
  status: 'initialized',
  editorId: randomUUID(),
  structuralDocuments: 4,
  structural: ['professional-profiles', 'site-navigation'].flatMap((collection) =>
    ['pt', 'en'].map((locale) => ({
      collection,
      locale,
      id: randomUUID(),
      updatedAt: '2026-11-05T00:00:00.000Z',
    })),
  ),
  freshProvisioning: true,
});

it('accepts the pending discriminant only with no editorial account or structural documents', () => {
  expect(validInitializationReceipt(pending(), selected)).toBe(true);
  for (const override of [
    { editorId: randomUUID() },
    { structuralDocuments: 1 },
    { structural: complete().structural },
    { freshProvisioning: true },
  ])
    expect(validInitializationReceipt({ ...pending(), ...override }, selected)).toBe(false);
});
it('preserves complete legacy receipt validation and the original structural baseline', () => {
  const original = complete();
  const next = {
    ...original,
    status: 'verified',
    freshProvisioning: false,
    structural: original.structural.map((item) => ({
      ...item,
      updatedAt: '2026-11-06T00:00:00.000Z',
    })),
  };
  expect(validInitializationReceipt(original, selected)).toBe(true);
  expect(mergeInitializationReceipt(original, next, selected)).toMatchObject({
    structural: original.structural,
    freshProvisioning: true,
  });
});
it('allows a same-target pending receipt to advance while refusing a completed-state downgrade', () => {
  const ready = complete();
  expect(mergeInitializationReceipt(pending(), ready, selected)).toEqual(ready);
  expect(() => mergeInitializationReceipt(ready, pending(), selected)).toThrow('downgraded');
});
it('does not replace another target or migration ledger while pending', () => {
  expect(() =>
    mergeInitializationReceipt(
      { ...pending(), database: 'another_database' },
      complete(),
      selected,
    ),
  ).toThrow();
  expect(() =>
    mergeInitializationReceipt(
      { ...pending(), migrationLedgerSha256: 'b'.repeat(64) },
      complete(),
      selected,
    ),
  ).toThrow();
});
it('keeps pending browser-first receipts out of the legacy authenticated HTTP seed', () => {
  const runtime = {
    APP_ENV: 'staging',
    NODE_ENV: 'production',
    STAGING_DATABASE_ONLY: 'false',
    PUBLIC_SITE_ENABLED: 'false',
    PUBLICATION_RETRIES_ENABLED: 'false',
    PUBLICATION_RETRY_WORKER_ENABLED: 'false',
    PUBLICATION_HTTP_VERIFICATION_ENABLED: 'false',
    SITE_ORIGIN: selected.origin,
    DATABASE_URI: 'postgres://synthetic:synthetic@127.0.0.1:5432/portfolio_stage',
    MEDIA_STORAGE_DRIVER: 'r2',
    MEDIA_BUCKET: 'adfl-test-stage',
    R2_BUCKET: 'adfl-test-stage',
    R2_MEDIA_PREFIX: 'portfolio/staging-proof',
  };
  expect(() => stagingSeedSettings(runtime, {}, pending(), selected.database)).toThrow(
    'initialization-receipt-required',
  );
});
