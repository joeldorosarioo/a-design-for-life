import { describe, expect, it } from 'vitest';
import { publicRootDirectory } from '../../src/helpers/payload/public-root-directory';
import { selectBackupJob } from './job-settings';
import {
  embeddedBuildRevision,
  embeddedOperationalCommand,
  embeddedStagingBackupEnvironment,
} from './runtime-entry';

const env = {
  NODE_ENV: 'production',
  APP_ENV: 'staging',
  DATABASE_URI: 'postgres://editor:synthetic-password@127.0.0.1:5432/a_design_for_life_staging',
  SITE_ORIGIN: 'https://staging.example.test',
  OPS_BACKUP_RECIPIENT: 'age1' + 'q'.repeat(58),
  OPS_BACKUP_SOURCE: 'atlas-staging',
  OPS_SOURCE_REVISION: 'a'.repeat(40),
  PUBLIC_SITE_ENABLED: 'false',
  PUBLICATION_RETRIES_ENABLED: 'false',
  PUBLICATION_RETRY_WORKER_ENABLED: 'false',
  PUBLICATION_HTTP_VERIFICATION_ENABLED: 'false',
} satisfies Partial<NodeJS.ProcessEnv>;
const input = {
  env,
  platform: 'linux' as const,
  uid: 70,
  alpineRelease: '3.24.0\n',
  buildRevision: 'a'.repeat(40),
  addresses: ['172.16.1.9'],
};

type Overrides = Partial<Parameters<typeof embeddedStagingBackupEnvironment>[0]>;

function select(overrides: Overrides = {}) {
  return embeddedStagingBackupEnvironment({ ...input, ...overrides });
}

describe('embedded Alpine staging backup boundary', () => {
  it('derives the source revision from the image when no operational revision is configured', () => {
    const withoutRevision = { ...env, OPS_SOURCE_REVISION: undefined };
    const derived = select({ env: withoutRevision });
    expect(derived.OPS_SOURCE_REVISION).toBe(input.buildRevision);
    expect(
      selectBackupJob({ ...withoutRevision, ...derived }, ['backup']).application('b'.repeat(64))
        .revision,
    ).toBe(input.buildRevision);
  });

  it('reads exactly the immutable build identity shape', () => {
    expect(embeddedBuildRevision({ revision: input.buildRevision })).toBe(input.buildRevision);
    for (const value of [
      null,
      [],
      'a'.repeat(40),
      {},
      { revision: 42 },
      { revision: 'draft-uncommitted' },
      { revision: input.buildRevision, environment: 'staging' },
    ])
      expect(() => embeddedBuildRevision(value)).toThrow(
        'Embedded staging build identity refused.',
      );
  });

  it('selects this container database without changing the publication namespace or credentials', () => {
    const derived = select();
    const mapped = { ...env, ...derived };
    const before = new URL(env.DATABASE_URI);
    const after = new URL(derived.DATABASE_URI);
    expect(after.hostname).toBe('172.16.1.9');
    expect(after.port).toBe('5432');
    expect(after.username).toBe(before.username);
    expect(after.password).toBe(before.password);
    expect(after.pathname).toBe(before.pathname);
    expect(derived.OPS_STAGING_DATABASE_TARGET).toBe('172.16.1.9:5432/a_design_for_life_staging');
    expect(derived.OPS_SOURCE_REVISION).toBe(input.buildRevision);
    expect(publicRootDirectory(mapped)).toBe(publicRootDirectory(env));
    expect(selectBackupJob(mapped, ['backup']).namespace).toEqual({
      project: 'a-design-for-life',
      environment: 'staging',
      source: 'atlas-staging',
    });
  });

  it.each<[string, Overrides]>([
    ['an unknown image revision', { buildRevision: 'draft-uncommitted' }],
    ['an abbreviated image revision', { buildRevision: 'a'.repeat(7) }],
    [
      'a mismatching environment revision',
      { env: { ...env, OPS_SOURCE_REVISION: 'b'.repeat(40) } },
    ],
    ['root', { uid: 0 }],
    ['another user', { uid: 1000 }],
    ['Windows', { platform: 'win32' as const }],
    ['another Alpine release', { alpineRelease: '3.20.0' }],
    ['production', { env: { ...env, APP_ENV: 'production' } }],
    ['a development process', { env: { ...env, NODE_ENV: 'development' } }],
    ['no private address', { addresses: ['127.0.0.1', '203.0.113.1'] }],
    ['ambiguous interfaces', { addresses: ['172.16.1.9', '10.0.0.2'] }],
    [
      'a different PostgreSQL host',
      { env: { ...env, DATABASE_URI: env.DATABASE_URI.replace('127.0.0.1', '10.0.0.2') } },
    ],
    [
      'a different PostgreSQL port',
      { env: { ...env, DATABASE_URI: env.DATABASE_URI.replace(':5432/', ':55435/') } },
    ],
    [
      'connection query options',
      { env: { ...env, DATABASE_URI: env.DATABASE_URI + '?options=unsafe' } },
    ],
    [
      'a mismatching explicit target',
      { env: { ...env, OPS_STAGING_DATABASE_TARGET: '10.0.0.2:5432/another_database' } },
    ],
  ])('refuses %s before initializing the native adapter', (_description, overrides) => {
    expect(() => select(overrides)).toThrow('Embedded staging backup configuration refused.');
  });

  it('does not bypass the operational prohibition on public staging or retry workers', () => {
    for (const name of [
      'PUBLIC_SITE_ENABLED',
      'PUBLICATION_RETRIES_ENABLED',
      'PUBLICATION_RETRY_WORKER_ENABLED',
      'PUBLICATION_HTTP_VERIFICATION_ENABLED',
    ]) {
      const configured = { ...env, [name]: 'true', ...select() };
      expect(() => selectBackupJob(configured, ['backup'])).toThrow(
        'Invalid operational backup job configuration.',
      );
    }
  });
});

describe('explicit operational commands in the same image', () => {
  it('keeps routine backup available and refuses an unapproved migration', () => {
    expect(embeddedOperationalCommand(['backup'], env)).toBe('backup');
    expect(() => embeddedOperationalCommand(['migrate'], env)).toThrow();
    expect(() =>
      embeddedOperationalCommand(['migrate'], { ...env, OPS_ALLOW_REVIEWED_MIGRATION: 'false' }),
    ).toThrow();
  });

  it('allows only the reviewed migration path with its explicit opt-in', () => {
    const approved = { ...env, OPS_ALLOW_REVIEWED_MIGRATION: 'true' };
    const command = embeddedOperationalCommand(['migrate'], approved);
    expect(command).toBe('migrate');
    expect(selectBackupJob({ ...approved, ...select() }, [command]).command).toBe('migrate');
    for (const args of [[], ['restore'], ['migrate', 'another-migration'], ['backup', '--drop']])
      expect(() => embeddedOperationalCommand(args, approved)).toThrow();
  });
});
