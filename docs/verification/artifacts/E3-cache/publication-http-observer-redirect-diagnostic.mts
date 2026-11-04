import { readFile } from 'node:fs/promises';
import { configureTestEnvironment } from 'file:///E:/a-design-for-life/testing/setup/test-environment.ts';
import { startOwnedNextServer } from 'file:///E:/a-design-for-life/testing/setup/owned-next-server.ts';
import { publicRootDirectory } from 'file:///E:/a-design-for-life/src/helpers/payload/public-root-directory.ts';
import { readPublicRoot } from 'file:///E:/a-design-for-life/src/helpers/payload/public-root.ts';

const original = JSON.parse(await readFile(new URL('./publication-http-observer-next-001-evidence.json', import.meta.url), 'utf8'));
process.env.ADFL_TEST_RUN_ID = original.runId;
const env = configureTestEnvironment();
const root = await readPublicRoot(publicRootDirectory(env));
const pending = original.observations.find((item: { phase?: string }) => item.phase === 'promoted-but-pending');
if (!root || root.generation !== pending?.generation) throw new Error('Expected original pending test generation.');
const historical = original.observations.find((item: { pathname?: string }) => item.pathname?.startsWith('/pt/cases/observer-first-'));
if (!historical?.pathname) throw new Error('Missing historical path in the first run.');
const server = await startOwnedNextServer({ env: process.env });
try {
  if (server.buildId !== original.builds[0]) throw new Error('Expected original owned Next build.');
  const response = await fetch(`${server.origin}${historical.pathname}`, {
    credentials: 'omit', redirect: 'manual', signal: AbortSignal.timeout(5_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const location = response.headers.get('location');
  console.log(JSON.stringify({ buildId: server.buildId, status: response.status, generation: response.headers.get('x-portfolio-generation'), expectedGeneration: root.generation, location, bytes: bytes.length, bodyExactlyLocation: bytes.toString('utf8') === location }));
} finally {
  await server.stop();
}
