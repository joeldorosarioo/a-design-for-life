import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import setupDatabase from './integration-global';
import { configureTestEnvironment } from './test-environment';
import { preserveNextGeneratedFiles } from './preserve-next-generated-files';

export default async function setup() {
  const env = configureTestEnvironment();
  const productionEnv = {
    ...process.env,
    ...env,
    NODE_ENV: 'production',
  } satisfies NodeJS.ProcessEnv;
  // This setup invokes Next directly, bypassing package build scripts. Compile
  // the stable stylesheet before allocating PostgreSQL or any HTTP listener.
  const stylesheet = spawnSync(process.execPath, ['scripts/emit-case-state-css.mjs'], {
    stdio: 'inherit',
    env: productionEnv,
    windowsHide: true,
  });
  if (stylesheet.error || stylesheet.status !== 0)
    throw stylesheet.error ?? new Error(`CSS de estado falhou: ${stylesheet.status}`);
  const origin = new URL(env.SITE_ORIGIN);
  const port = Number(origin.port || 80);
  const hostname = origin.hostname === '[::1]' ? '::1' : origin.hostname;
  const probe = createServer();
  probe.listen(port, hostname);
  await once(probe, 'listening');
  await new Promise<void>((resolve) => probe.close(() => resolve()));

  const stopDatabase = await setupDatabase();
  try {
    const sourceFiles = await preserveNextGeneratedFiles({
      root: process.cwd(),
      distDir: process.env.NEXT_TEST_DIST_DIR!,
    });
    let build: ReturnType<typeof spawnSync>;
    try {
      build = spawnSync(process.execPath, ['./node_modules/next/dist/bin/next', 'build'], {
        stdio: 'inherit',
        env: productionEnv,
        windowsHide: true,
      });
    } finally {
      await sourceFiles.restore();
    }
    if (build.error || build.status !== 0)
      throw build.error ?? new Error('Build local falhou: ' + build.status);
  } catch (error) {
    stopDatabase();
    throw error;
  }

  const server = spawn(
    process.execPath,
    ['./node_modules/next/dist/bin/next', 'start', '--hostname', hostname, '--port', String(port)],
    {
      stdio: 'inherit',
      env: productionEnv,
      windowsHide: true,
    },
  );
  const exited = once(server, 'exit');
  const close = async () => {
    if (server.exitCode === null && !server.killed) server.kill('SIGTERM');
    await exited;
    stopDatabase();
  };
  try {
    const deadline = Date.now() + 30_000;
    while (true) {
      if (server.exitCode !== null) throw new Error(`Servidor local encerrou: ${server.exitCode}`);
      let response: Response | undefined;
      try {
        // This is the first HTTP request of the fresh production process, before
        // any admin route can install a factory in its own server module graph.
        response = await fetch(`${env.SITE_ORIGIN}/pt/cases/e1-5-cold-start-probe`, {
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        /* Server startup has not completed. */
      }
      if (response) {
        console.info(
          'Cold process first HTTP response: GET /pt/cases/e1-5-cold-start-probe',
          response.status,
        );
        if (response.status !== 404)
          throw new Error(
            `Cold public route must resolve unknown content as 404, received ${response.status}`,
          );
        break;
      }
      if (Date.now() >= deadline) throw new Error('Painel local não ficou pronto em 30 segundos');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } catch (error) {
    await close();
    throw error;
  }
  return close;
}
