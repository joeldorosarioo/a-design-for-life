import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
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
    MEDIA_BUCKET: z.string().min(1),
  })
  .superRefine((env, context) => {
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
