import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
import { CaseContent } from './case-content';
import { mapCaseDetail } from '../../server/map-case-detail';
import {
  publicEndpointRequest,
  publishedFixtureEntry,
  publishedLocaleHandler,
  withPublishedEndpointRoot,
} from '../../../../../testing/fixtures/published-root-endpoint';

vi.mock('node:fs/promises', async (original) => {
  const filesystem = await original<typeof import('node:fs/promises')>();
  return { ...filesystem, readFile: vi.fn(filesystem.readFile) };
});

const order = (caseId: string, sortOrder: number, featured: boolean) =>
  publishedFixtureEntry({ kind: 'case-order', caseId, sortOrder, featured });

function content(caseId: string, locale: 'pt' | 'en', title: string, slug: string) {
  const contentId = randomUUID();
  return [
    `case-content/${contentId}`,
    publishedFixtureEntry({
      kind: 'case',
      contentId,
      caseId,
      locale,
      slug,
      slugs: ['private-history', slug],
      detail: mapCaseDetail({
        id: contentId,
        case: caseId,
        locale,
        title,
        slug,
        introduction: 'Detail body',
        _status: 'published',
        createdAt: '',
        updatedAt: '',
      }),
    }),
  ] as const;
}

it('returns only confirmed locale cards and featured cards from one captured generation while current.json advances', async () => {
  await withPublishedEndpointRoot(async ({ current, write, selections }) => {
    const handler = publishedLocaleHandler(CaseContent);
    expect(handler).toBeDefined();
    const a = randomUUID();
    const b = randomUUID();
    const privateId = randomUUID();
    const generation = randomUUID();
    await write({
      generation,
      subjects: Object.fromEntries([
        [`cases/${a}`, order(a, 2, true)],
        [`cases/${b}`, order(b, 1, false)],
        [`cases/${privateId}`, order(privateId, 0, true)],
        content(a, 'pt', 'Confirmed A', 'case-a'),
        content(b, 'pt', 'Confirmed B', 'case-b'),
        content(a, 'en', 'English only', 'english-a'),
      ]),
    });
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    const reads = vi.mocked(readFile);
    reads.mockClear();
    reads.mockImplementationOnce(async (file, options) => {
      const selected = await actual.readFile(file, options);
      const replacement = `${current}.next`;
      await writeFile(replacement, JSON.stringify({ generation: randomUUID(), subjects: {} }));
      await rename(replacement, current);
      return selected;
    });
    const response = await handler!(publicEndpointRequest('pt'));
    expect(response.status).toBe(200);
    expect(response.headers.get('x-portfolio-generation')).toBe(generation);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const card = (caseId: string, title: string, slug: string) => ({
      caseId,
      locale: 'pt',
      title,
      eyebrow: null,
      summary: null,
      cover: null,
      path: `/pt/cases/${slug}`,
    });
    expect(await response.json()).toEqual({
      ok: true,
      value: {
        cards: [card(b, 'Confirmed B', 'case-b'), card(a, 'Confirmed A', 'case-a')],
        featured: [card(a, 'Confirmed A', 'case-a')],
      },
    });
    expect(selections()).toBe(1);
    expect(reads.mock.calls.map(([file]) => file)).toEqual([current]);
  });
});

it('distinguishes confirmed empty cards from a missing, empty or corrupt root', async () => {
  await withPublishedEndpointRoot(async ({ current, write }) => {
    const handler = publishedLocaleHandler(CaseContent);
    expect(handler).toBeDefined();
    const request = publicEndpointRequest('pt');
    const missing = await handler!(request);
    expect(missing.status).toBe(503);
    expect(missing.headers.get('x-portfolio-generation')).toBeNull();
    const generation = randomUUID();
    await write({ generation, subjects: {} });
    expect((await handler!(request)).status).toBe(503);
    await writeFile(current, 'corrupt');
    expect((await handler!(request)).status).toBe(503);
    const id = randomUUID();
    await write({ generation, subjects: { [`cases/${id}`]: order(id, 1, true) } });
    const empty = await handler!(request);
    expect(empty.status).toBe(200);
    expect(empty.headers.get('x-portfolio-generation')).toBe(generation);
    expect(await empty.json()).toEqual({ ok: true, value: { cards: [], featured: [] } });
    expect((await handler!(publicEndpointRequest('invalid'))).status).toBe(404);
  });
});
