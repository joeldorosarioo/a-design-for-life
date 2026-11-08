import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import setupDatabase from './integration-global';
import { configureTestEnvironment } from './test-environment';

export default async function setup() {
  const env = configureTestEnvironment();
  const origin = new URL(env.SITE_ORIGIN);
  const port = Number(origin.port || 80);
  const hostname = origin.hostname === '[::1]' ? '::1' : origin.hostname;
  const probe = createServer();
  probe.listen(port, hostname);
  await once(probe, 'listening');
  await new Promise<void>((resolve) => probe.close(() => resolve()));

  const stopDatabase = setupDatabase();
  const productionEnv = {
    ...process.env,
    ...env,
    NODE_ENV: 'production',
  } satisfies NodeJS.ProcessEnv;
  const build = spawnSync(process.execPath, ['./node_modules/next/dist/bin/next', 'build'], {
    stdio: 'inherit',
    env: productionEnv,
    windowsHide: true,
  });
  if (build.error || build.status !== 0) {
    stopDatabase();
    throw build.error ?? new Error(`Build local falhou: ${build.status}`);
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
      try {
        const response = await fetch(`${env.SITE_ORIGIN}/admin/login`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (response.ok) break;
      } catch {
        /* Server startup has not completed. */
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
