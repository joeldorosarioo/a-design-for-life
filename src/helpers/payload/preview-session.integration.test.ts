import { afterAll, beforeAll, expect, it } from 'vitest';
import { createEditorialPayloadFixture } from '../../../testing/fixtures/editorial-payload';
import { installPayloadProvider } from './runtime';
import { authorizePreview } from './preview-session';
import { authHTTP } from '../../../testing/fixtures/editorial-auth';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let id: string;
let cookie: string;
const preview = (query: string, authenticated = true, extra: HeadersInit = {}) =>
  new Request(`${process.env.SITE_ORIGIN}/preview?${query}`, {
    headers: { origin: process.env.SITE_ORIGIN!, ...(authenticated ? { cookie } : {}), ...extra },
  });
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e1.7-preview-integration');
  installPayloadProvider(async () => fixture.payload);
  const login = await authHTTP(
    'login',
    { email: fixture.user.email, password: 'Synthetic-editorial-test-password-123!' },
    undefined,
    'e1.7-preview-integration',
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Synthetic private preview scope' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const doc = await fixture.payload.create({
    collection: 'case-content',
    data: { case: parent.id, locale: 'pt', title: 'Synthetic private draft title' },
    draft: true,
    req: await fixture.request(),
    overrideAccess: false,
  });
  id = doc.id;
});
afterAll(async () => {
  await fixture?.payload.destroy();
});
it('requires a native session for the helper and applies explicit anonymous Local API access', async () => {
  const result = await authorizePreview(
    preview(`collection=case-content&id=${id}&locale=pt`, false),
  );
  expect(result.ok).toBe(false);
  const publicRead = await fixture.payload.find({
    collection: 'case-content',
    where: { id: { equals: id } },
    draft: false,
    overrideAccess: false,
  });
  expect(publicRead.docs.length).toBe(0);
});
it('returns only the closed document and locale scope after native authentication', async () => {
  const result = await authorizePreview(preview(`collection=case-content&id=${id}&locale=pt`));
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.document.id).toBe(id);
    expect(result.value.document.title).toBe('Synthetic private draft title');
  }
  const wrongLocale = await authorizePreview(preview(`collection=case-content&id=${id}&locale=en`));
  expect(wrongLocale.ok).toBe(false);
  const wrongCollection = await authorizePreview(
    preview(`collection=users&id=${fixture.user.id}&locale=pt`),
  );
  expect(wrongCollection.ok).toBe(false);
});
it('rejects untrusted origins and ambiguous external return paths before reading a document', async () => {
  for (const returnTo of [
    'https://external.example/',
    '//external.example/',
    '/pt/%2f%2fexternal.example',
    '/pt\\external.example',
  ]) {
    const result = await authorizePreview(
      preview(
        `collection=case-content&id=${id}&locale=pt&returnTo=${encodeURIComponent(returnTo)}`,
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-input');
  }
  expect(
    (
      await authorizePreview(
        preview(`collection=case-content&id=${id}&locale=pt`, true, {
          origin: 'https://external.example',
        }),
      )
    ).ok,
  ).toBe(false);
});
it('rejects the same signed cookie once its native session has been revoked', async () => {
  await fixture.payload.db.updateOne({
    collection: 'users',
    id: fixture.user.id,
    data: { sessions: [] },
  });
  expect((await authorizePreview(preview(`collection=case-content&id=${id}&locale=pt`))).ok).toBe(
    false,
  );
});
