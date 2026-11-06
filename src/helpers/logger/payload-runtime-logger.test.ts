import { BasePayload, buildConfig, type Config } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { afterEach, expect, it, vi } from 'vitest';
import { createLogger, payloadRuntimeLoggerOptions } from './logger';

afterEach(() => vi.unstubAllEnvs());

async function createNativeLogger(config: Config['logger']) {
  vi.stubEnv('PAYLOAD_DISABLE_DEPENDENCY_CHECKER', 'true');
  const payload = new BasePayload();
  const settings = buildConfig({
    secret: 'synthetic-scope-logger-test-only',
    telemetry: false,
    typescript: { autoGenerate: false },
    db: postgresAdapter({
      pool: { connectionString: 'postgres://synthetic:synthetic@127.0.0.1:9/adfl_test_logger' },
      push: false,
      disableCreateDatabase: true,
    }),
    logger: config,
  });
  await payload.init({ config: settings, disableDBConnect: true, disableOnInit: true });
  return payload;
}

it.each(['staging', 'production'] as const)(
  'sends only closed diagnostic fields through the real Native logger in %s',
  async (environment) => {
    const lines: string[] = [];
    const sink = createLogger({
      write(line) {
        lines.push(line);
        return true;
      },
    });
    const payload = await createNativeLogger(payloadRuntimeLoggerOptions(environment, sink));
    try {
      lines.length = 0;
      const error = Object.assign(new Error('synthetic-draft-private-text'), {
        status: 503,
        cause: { token: 'synthetic-reset-token' },
      });
      const child = payload.logger.child({ authorization: 'synthetic-auth-header' });
      child.error({ err: error, cookie: 'synthetic-cookie' }, 'synthetic-email-address');
      child.warn({ statusCode: 429, password: 'synthetic-secret-password' });
      expect(lines).toHaveLength(2);
      expect(lines.join('')).not.toMatch(
        /synthetic-|stack|hostname|password|authorization|cookie/i,
      );
      expect(lines.map((line) => JSON.parse(line))).toMatchObject([
        {
          level: 'error',
          operation: 'payload.runtime',
          result: 'failure',
          context: { statusCode: 503 },
        },
        {
          level: 'error',
          operation: 'payload.runtime',
          result: 'failure',
          context: { statusCode: 429 },
        },
      ]);
    } finally {
      await payload.destroy();
    }
  },
);

it.each(['local', 'test'] as const)(
  'preserves the usual Native logging setup in %s',
  (environment) => {
    expect(payloadRuntimeLoggerOptions(environment)).toBeUndefined();
  },
);
