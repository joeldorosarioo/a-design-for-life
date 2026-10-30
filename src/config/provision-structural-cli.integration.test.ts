import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createEditorialPayloadFixture,
  clearStructuralFixture,
} from '../../testing/fixtures/editorial-payload';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.3-cli-consumer');
  await clearStructuralFixture(fixture.payload);
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
function cli(env = process.env) {
  return spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      './node_modules/payload/bin.js',
      'run',
      'src/config/provision-structural-documents.cli.ts',
    ],
    { env, encoding: 'utf8', windowsHide: true, timeout: 30000 },
  );
}
it('o consumidor CLI nativo repete sem alterar drafts nem criar contas', async () => {
  const usersBefore = (await fixture.payload.find({ collection: 'users' })).totalDocs;
  const first = cli();
  expect({ status: first.status, stderr: first.stderr }).toMatchObject({ status: 0 });
  const snapshot = async () =>
    Promise.all(
      (['site-navigation', 'professional-profiles'] as const).map(async (collection) => {
        const result = await fixture.payload.find({
          collection,
          draft: true,
          req: await fixture.request(),
          overrideAccess: false,
        });
        expect(result.docs.map((doc) => [doc.locale, doc._status]).sort()).toEqual([
          ['en', 'draft'],
          ['pt', 'draft'],
        ]);
        expect((await fixture.payload.find({ collection, overrideAccess: false })).totalDocs).toBe(
          0,
        );
        return result.docs.map((doc) => [doc.id, doc.updatedAt]).sort();
      }),
    );
  const before = await snapshot();
  const second = cli();
  expect({ status: second.status, stderr: second.stderr }).toMatchObject({ status: 0 });
  expect(await snapshot()).toEqual(before);
  expect((await fixture.payload.find({ collection: 'users' })).totalDocs).toBe(usersBefore);
});
it('o CLI recusa ambiente fora da autorização da etapa com saída não zero', () => {
  const result = cli({ ...process.env, APP_ENV: 'staging', NODE_ENV: 'development' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'This stage only authorizes local or isolated-test provisioning.',
  );
});
