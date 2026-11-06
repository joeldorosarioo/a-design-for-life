import 'server-only';
import path from 'node:path';
import { z } from 'zod';

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
    // Absence is OFF. Enable only after the additive metadata migration is applied.
    PUBLICATION_RETRIES_ENABLED: z.enum(['true', 'false']).optional(),
    PUBLICATION_RETRY_WORKER_ENABLED: z.enum(['true', 'false']).optional(),
    PUBLICATION_HTTP_VERIFICATION_ENABLED: z.enum(['true', 'false']).optional(),
    PUBLIC_SITE_ENABLED: z.enum(['true', 'false']).optional(),
    EDITORIAL_FIRST_ACCESS_ENABLED: z.enum(['true', 'false']).optional(),
    GA4_MEASUREMENT_ID: z
      .string()
      .regex(/^G-[A-Z0-9]{4,32}$/)
      .optional(),
    PAYLOAD_SECRET: z.string().min(32),
    DATABASE_URI: z
      .url()
      .refine(
        (value) =>
          URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
        {
          message: 'DATABASE_URI deve usar PostgreSQL',
        },
      ),
    SITE_ORIGIN: z.url().refine(
      (value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          url.pathname === '/' &&
          !url.search &&
          !url.hash &&
          !url.username &&
          !url.password
        );
      },
      { message: 'SITE_ORIGIN deve ser uma origem HTTP(S) sem caminho ou credenciais' },
    ),
    INTERNAL_HTTP_ORIGIN: z
      .url()
      .refine(
        (value) => {
          const url = new URL(value);
          return (
            /^http:\/\/(?:127\.0\.0\.1|\[::1\])(?::\d+)?\/?$/.test(value) &&
            url.protocol === 'http:' &&
            ['127.0.0.1', '[::1]'].includes(url.hostname) &&
            url.pathname === '/' &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          );
        },
        { message: 'INTERNAL_HTTP_ORIGIN deve usar HTTP de loopback literal sem dados extras' },
      )
      .optional(),
    MEDIA_BUCKET: z.string().min(1),
    MEDIA_STORAGE_ROOT: z.string().min(1).optional(),
    MEDIA_CHECKER_BINARY: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if (env.EDITORIAL_FIRST_ACCESS_ENABLED === 'true') {
      const database = URL.parse(env.DATABASE_URI);
      const staging =
        env.APP_ENV === 'staging' && URL.parse(env.SITE_ORIGIN)?.protocol === 'https:';
      const isolatedTest =
        env.APP_ENV === 'test' &&
        database?.hostname === '127.0.0.1' &&
        database.port === '55434' &&
        database.pathname === '/adfl_test_runner' &&
        database.username === 'adfl_test' &&
        database.password === 'synthetic-local-test-only' &&
        env.MEDIA_BUCKET === 'adfl-test-runner';
      if (env.PUBLIC_SITE_ENABLED !== 'false' || (!staging && !isolatedTest))
        context.addIssue({
          code: 'custom',
          path: ['EDITORIAL_FIRST_ACCESS_ENABLED'],
          message:
            'Browser first access requires explicit private HTTPS staging or the exact isolated test runner.',
        });
    }
    if (
      env.PUBLICATION_RETRY_WORKER_ENABLED === 'true' &&
      env.PUBLICATION_RETRIES_ENABLED !== 'true'
    )
      context.addIssue({
        code: 'custom',
        path: ['PUBLICATION_RETRY_WORKER_ENABLED'],
        message: 'Publication retry worker requires enabled migrated retry metadata.',
      });
    if (env.PUBLICATION_HTTP_VERIFICATION_ENABLED === 'true') {
      const database = URL.parse(env.DATABASE_URI);
      if (
        env.APP_ENV !== 'test' ||
        !env.INTERNAL_HTTP_ORIGIN ||
        database?.hostname !== '127.0.0.1' ||
        database.port !== '55434' ||
        database.pathname !== '/adfl_test_runner' ||
        env.MEDIA_BUCKET !== 'adfl-test-runner'
      )
        context.addIssue({
          code: 'custom',
          path: ['PUBLICATION_HTTP_VERIFICATION_ENABLED'],
          message:
            'HTTP verification requires the isolated test runner and an explicit loopback origin.',
        });
    }
    if (env.APP_ENV === 'production' && env.PUBLIC_SITE_ENABLED === 'true') {
      if (!env.GA4_MEASUREMENT_ID)
        context.addIssue({
          code: 'custom',
          path: ['GA4_MEASUREMENT_ID'],
          message: 'Public production requires its approved measurement configuration',
        });
      if (!URL.canParse(env.SITE_ORIGIN) || new URL(env.SITE_ORIGIN).protocol !== 'https:')
        context.addIssue({
          code: 'custom',
          path: ['SITE_ORIGIN'],
          message: 'Public production requires HTTPS',
        });
    }
    if (env.NODE_ENV !== 'test' && env.APP_ENV !== 'test') return;
    if (env.APP_ENV !== 'test') {
      context.addIssue({
        code: 'custom',
        path: ['APP_ENV'],
        message: 'Testes exigem APP_ENV=test',
      });
    }
    if (URL.canParse(env.DATABASE_URI)) {
      const database = new URL(env.DATABASE_URI);
      if (env.MEDIA_STORAGE_ROOT) {
        const expected = path.resolve(
          '.work/private-media',
          env.MEDIA_BUCKET,
          database.pathname.slice(1),
        );
        const selected = path.resolve(env.MEDIA_STORAGE_ROOT);
        const same =
          process.platform === 'win32'
            ? selected.toLowerCase() === expected.toLowerCase()
            : selected === expected;
        if (!path.isAbsolute(env.MEDIA_STORAGE_ROOT) || !same)
          context.addIssue({
            code: 'custom',
            path: ['MEDIA_STORAGE_ROOT'],
            message: 'Testes exigem armazenamento privado no namespace isolado de bucket e banco',
          });
      }

      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
        !/^\/adfl_test_[a-z0-9_]+$/.test(database.pathname)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['DATABASE_URI'],
          message: 'Testes exigem PostgreSQL local com banco adfl_test_*',
        });
      }
    }
    if (
      URL.canParse(env.SITE_ORIGIN) &&
      (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.SITE_ORIGIN).hostname) ||
        new URL(env.SITE_ORIGIN).protocol !== 'http:')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SITE_ORIGIN'],
        message: 'Testes locais exigem origem HTTP de loopback',
      });
    }
    if (!/^adfl-test-[a-z0-9-]+$/.test(env.MEDIA_BUCKET)) {
      context.addIssue({
        code: 'custom',
        path: ['MEDIA_BUCKET'],
        message: 'Testes exigem bucket adfl-test-*',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(input: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(input);
}

export function resolveInternalHttpOrigin(env: ServerEnv): string | null {
  if (env.INTERNAL_HTTP_ORIGIN) return new URL(env.INTERNAL_HTTP_ORIGIN).origin;
  if (env.APP_ENV !== 'local' && env.APP_ENV !== 'test') return null;
  const site = new URL(env.SITE_ORIGIN);
  if (site.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname))
    return null;
  if (site.hostname === 'localhost') site.hostname = '127.0.0.1';
  return site.origin;
}
