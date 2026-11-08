import { afterAll, beforeAll, expect, it } from 'vitest';
import { getPayload } from 'payload';
import config from '@payload-config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createEditorialPayloadFixture } from '../../../../testing/fixtures/editorial-payload';
import {
  mediaMetadataFixture,
  casePublicationFixture,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { confirmTestPublication } from '../../../../testing/fixtures/confirmed-publication';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { installPublicationProvider } from '@/helpers/payload/publication-runtime';
import { readPublicRoot } from '@/helpers/payload/public-root';
import { portfolioPublicationCoordinator } from '@/config/publication';
import { resolveCaseRoute } from './resolve-case-route';
let fixture: Awaited<ReturnType<typeof createEditorialPayloadFixture>>;
let directory: string;
beforeAll(async () => {
  fixture = await createEditorialPayloadFixture('e2-captured-null-route');
  const native = await getPayload({ config });
  installPayloadProvider(async () => native);
  directory = await mkdtemp(path.join(tmpdir(), 'portfolio-route-capture-'));
  installPublicationProvider(() => portfolioPublicationCoordinator(directory));
});
afterAll(async () => {
  await fixture?.payload.destroy();
  if (directory?.startsWith(path.join(tmpdir(), 'portfolio-route-capture-')))
    await rm(directory, { recursive: true, force: true });
});
it('does not reselect current when the caller captured no root before a real route publication', async () => {
  const image = await mediaMetadataFixture(fixture.payload);
  const parent = await fixture.payload.create({
    collection: 'cases',
    data: { internalTitle: 'Captured-null route' },
    req: await fixture.request(),
    overrideAccess: false,
  });
  const published = await fixture.payload.create({
    collection: 'case-content',
    data: {
      ...casePublicationFixture(image.id),
      case: parent.id,
      locale: 'pt',
      _status: 'published',
    },
    req: await fixture.request(),
    overrideAccess: false,
  });
  await confirmTestPublication(published, await fixture.request());
  const current = (await readPublicRoot(directory))!;
  expect(current.subjects[`case-content/${published.id}`]).toBeDefined();
  await expect(
    resolveCaseRoute('pt', published.slug!, fixture.payload, current),
  ).resolves.toMatchObject({ status: 200 });
  // The pre-fix implementation incorrectly substitutes the now-current root.
  await expect(resolveCaseRoute('pt', published.slug!, fixture.payload, null)).resolves.toEqual({
    status: 503,
    locale: 'pt',
  });
  expect(await readPublicRoot(directory)).toEqual(current);
  await expect(resolveCaseRoute('pt', published.slug!, fixture.payload)).resolves.toMatchObject({
    status: 200,
  });
});
