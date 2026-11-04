import { once } from 'node:events';
import { createServer } from 'node:http';
import { assertServedPublication } from '@/helpers/payload/publication-http-verification';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  mapCaseDetail,
  renderCaseRouteResponse,
  selectCaseStatePresentation,
} from '@/features/cases/server';
import { mapProfile } from '@/features/professional-profile/server';
import type { PublicationUpdate } from '@/payload-types';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { planPublicationObservations } from './portfolio-publication-observation';

const siteOrigin = 'https://portfolio.example.invalid';
const entry = (value: PublicRoot['subjects'][string]['value']) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value,
});

function intent(
  collection: PublicationUpdate['subjectCollection'],
  subjectId: string,
  subject: ReturnType<typeof entry>,
): PublicationUpdate {
  return {
    id: randomUUID(),
    operationId: subject.operationId,
    targetRevision: subject.targetRevision,
    subjectCollection: collection,
    subjectId,
    state: 'update-pending',
    attempts: 0,
    dependencies: [],
    target: subject.value,
    createdAt: '',
    updatedAt: '',
  };
}

it('proves initial shared order with empty public DTOs in both languages before the shell exists', async () => {
  const caseId = randomUUID();
  const shared = entry({ kind: 'case-order', caseId, sortOrder: 0, featured: true });
  const root = { generation: randomUUID(), subjects: { ['cases/' + caseId]: shared } };
  const plan = await planPublicationObservations({
    root,
    operation: intent('cases', caseId, shared),
    siteOrigin,
  });
  expect(plan.map(({ path, status }) => [path, status])).toEqual([
    ['/api/case-content/published/pt', 200],
    ['/api/case-content/published/en', 200],
  ]);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const valid = Buffer.from(JSON.stringify({ ok: true, value: { cards: [], featured: [] } }));
  const expanded = Buffer.from(
    JSON.stringify({ ok: true, value: { cards: [], featured: [], privateId: caseId } }),
  );
  expect(plan.every((probe) => probe.matches(valid, headers))).toBe(true);
  expect(plan.some((probe) => probe.matches(expanded, headers))).toBe(false);
});

it('verifies current detail, canonical history and withdrawn routes with one root and the same fixed canonical origin', async () => {
  const caseId = randomUUID();
  const contentId = randomUUID();
  const order = entry({ kind: 'case-order', caseId, sortOrder: 0, featured: true });
  const dto = mapCaseDetail({
    id: contentId,
    case: caseId,
    locale: 'pt',
    slug: 'atual',
    title: 'Projeto atual',
    summary: 'Resumo',
    _status: 'published',
    createdAt: '',
    updatedAt: '',
  });
  const old = {
    media: [],
    mediaObservation: { removed: [] },
    kind: 'case',
    caseId,
    contentId,
    locale: 'pt',
    slug: 'atual',
    slugs: ['antigo', 'atual'],
    detail: JSON.parse(JSON.stringify(dto)),
  };
  const rootFor = (subject: ReturnType<typeof entry>) => ({
    generation: randomUUID(),
    subjects: { ['cases/' + caseId]: order, ['case-content/' + contentId]: subject },
  });
  const published = entry(old);
  const online = await planPublicationObservations({
    root: rootFor(published),
    operation: intent('case-content', contentId, published),
    siteOrigin,
  });
  expect(online.map(({ path, status }) => [path, status])).toEqual([
    ['/api/case-content/published/pt', 200],
    ['/pt/cases/atual', 200],
    ['/pt/cases/antigo', 308],
  ]);
  const redirected = online.at(-1)!;
  const destination = siteOrigin + '/pt/cases/atual';
  expect(redirected.matches(Buffer.from(destination), new Headers({ Location: destination }))).toBe(
    true,
  );
  expect(
    redirected.matches(Buffer.from('unexpected body'), new Headers({ Location: destination })),
  ).toBe(false);
  expect(
    redirected.matches(
      Buffer.from('/pt/cases/atual'),
      new Headers({ Location: '/pt/cases/atual' }),
    ),
  ).toBe(true);
  expect(
    redirected.matches(Buffer.alloc(0), new Headers({ Location: siteOrigin + '/pt/cases/atual' })),
  ).toBe(true);
  expect(
    redirected.matches(
      Buffer.alloc(0),
      new Headers({ Location: 'https://wrong.invalid/pt/cases/atual' }),
    ),
  ).toBe(false);

  const revoked = entry({ ...old, slug: null, detail: null });
  const offline = await planPublicationObservations({
    root: rootFor(revoked),
    operation: intent('case-content', contentId, revoked),
    siteOrigin,
  });
  expect(offline.map(({ path, status }) => [path, status])).toEqual([
    ['/api/case-content/published/pt', 200],
    ['/pt/cases/antigo', 410],
    ['/pt/cases/atual', 410],
  ]);
});

it('does not observe a requested operation superseded in the actual selected root', async () => {
  const caseId = randomUUID();
  const prior = entry({ kind: 'case-order', caseId, sortOrder: 0, featured: false });
  const next = entry({ kind: 'case-order', caseId, sortOrder: 1, featured: true });
  const root = { generation: randomUUID(), subjects: { ['cases/' + caseId]: next } };
  await expect(
    planPublicationObservations({ root, operation: intent('cases', caseId, prior), siteOrigin }),
  ).rejects.toThrow('Publication observation requires the selected operation.');
});

function mediaWithdrawal(
  removed?: { mediaId: string; variant: 'original' }[],
  slugs: string[] = [],
) {
  const caseId = randomUUID();
  const contentId = randomUUID();
  const subject = entry({
    kind: 'case',
    caseId,
    contentId,
    locale: 'pt',
    slug: null,
    detail: null,
    slugs,
    media: [],
    ...(removed && { mediaObservation: { removed } }),
  });
  const root: PublicRoot = {
    generation: randomUUID(),
    subjects: {
      [`cases/${caseId}`]: entry({ kind: 'case-order', caseId, sortOrder: 0, featured: false }),
      [`case-content/${contentId}`]: subject,
    },
  };
  return { root, operation: intent('case-content', contentId, subject), siteOrigin };
}

it.each(['technical', 'editorial'] as const)(
  'requires the exact %s withdrawal document and rejects a live case even with its heading and 410 headers',
  async (variant) => {
    const input = mediaWithdrawal([], ['withdrawn']);
    if (variant === 'editorial') {
      input.root.subjects[`professional-profiles/${randomUUID()}`] = entry({
        kind: 'profile',
        locale: 'pt',
        profile: JSON.parse(
          JSON.stringify(
            mapProfile({
              id: randomUUID(),
              locale: 'pt',
              _status: 'published',
              contacts: {
                email: 'editorial@example.invalid',
                linkedin: 'https://www.linkedin.com/in/confirmed',
              },
              resume: randomUUID(),
              createdAt: '',
              updatedAt: '',
            }),
          ),
        ),
      });
      input.root.subjects[`site-navigation/${randomUUID()}`] = entry({
        kind: 'navigation',
        locale: 'pt',
        navigation: {
          locale: 'pt',
          header: {
            brandLabel: 'Marca',
            projectsLabel: 'Projetos',
            aboutLabel: 'Sobre',
            resumeLabel: 'CV',
            contactLabel: 'Contato',
          },
          footer: {
            title: 'Rodapé',
            emailLabel: 'E-mail',
            linkedinLabel: 'LinkedIn',
            resumeLabel: 'CV',
          },
          controls: {
            newTabLabel: 'Nova aba',
            openMenuLabel: 'Abrir',
            closeMenuLabel: 'Fechar',
            languageLabel: 'Idioma',
          },
          messages: {
            caseUnavailableTitle: 'Retirada editorial',
            caseUnavailableDescription: 'Descrição editorial',
          },
        },
      });
    }
    const path = '/pt/cases/withdrawn';
    const probe = (await planPublicationObservations(input)).find((item) => item.path === path);
    expect(probe?.status).toBe(410);
    const locale = 'pt';
    const presentation = await selectCaseStatePresentation({
      locale,
      status: 410,
      root: input.root,
    });
    const heading = variant === 'editorial' ? 'Retirada editorial' : 'Case indisponível';
    expect(presentation?.title ?? null).toBe(variant === 'editorial' ? heading : null);
    const genuine = renderCaseRouteResponse({ status: 410, locale }, locale, presentation);
    const bytes = Buffer.from(await genuine.arrayBuffer());
    const stale = Buffer.from(
      `<!doctype html><html lang="pt"><head><meta name="robots" content="noindex, nofollow"><title>${heading}</title></head><body><main><article data-reading-key="case-opening"><h1>${heading}</h1><p>Old public detail content</p></article></main></body></html>`,
    );

    expect(probe!.matches(bytes, genuine.headers)).toBe(true);
    expect(probe!.matches(stale, genuine.headers)).toBe(false);
    const wrongMime = new Headers(genuine.headers);
    wrongMime.set('Content-Type', 'application/json');
    expect(probe!.matches(bytes, wrongMime)).toBe(false);
    const missingRobots = new Headers(genuine.headers);
    missingRobots.delete('X-Robots-Tag');
    expect(probe!.matches(bytes, missingRobots)).toBe(false);
  },
);

it('cannot acknowledge public withdrawal through the HTTP plan while the revoked asset still returns bytes', async () => {
  const mediaId = randomUUID();
  const input = mediaWithdrawal([{ mediaId, variant: 'original' }]);
  const mediaPath = `/media/${mediaId}/original`;
  let leaking = true;
  const requests: [string | undefined, string | undefined, string | undefined][] = [];
  const observer = createServer((request, response) => {
    requests.push([request.method, request.url, request.headers.range]);
    response.setHeader(publicGenerationHeader, input.root.generation);
    if (request.url === '/api/case-content/published/pt') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true, value: { cards: [], featured: [] } }));
    } else if (request.url === mediaPath) {
      response.writeHead(leaking ? 200 : 404, { 'Cache-Control': 'private, no-store' });
      response.end(leaking ? 'Synthetic leaked bytes' : undefined);
    } else {
      response.writeHead(500);
      response.end();
    }
  });
  try {
    const listening = once(observer, 'listening');
    observer.listen(0, '127.0.0.1');
    await listening;
    const address = observer.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing owned loopback observer.');
    const verify = async () =>
      assertServedPublication({
        origin: `http://127.0.0.1:${address.port}`,
        generation: input.root.generation,
        observations: await planPublicationObservations(input),
      });
    await expect(verify()).rejects.toThrow('Public HTTP verification failed.');
    expect(requests).toEqual([
      ['GET', '/api/case-content/published/pt', undefined],
      ['GET', mediaPath, undefined],
    ]);
    leaking = false;
    requests.length = 0;
    await expect(verify()).resolves.toBeUndefined();
    expect(requests).toEqual([
      ['GET', '/api/case-content/published/pt', undefined],
      ['GET', mediaPath, undefined],
      ['HEAD', mediaPath, undefined],
      ['GET', mediaPath, 'bytes=0-15'],
    ]);
  } finally {
    if (observer.listening) {
      const closed = new Promise<void>((resolve, reject) => {
        observer.close((error) => (error ? reject(error) : resolve()));
      });
      observer.closeAllConnections();
      await closed;
    }
  }
});

it('does not treat historical missing provenance on a promoted pending case as proof of no removals', async () => {
  const historical = mediaWithdrawal();
  await expect(planPublicationObservations(historical)).rejects.toThrow(
    'Public media observation provenance unavailable.',
  );
  // Terminal public A1 roots remain readable and can recheck the known current projections.
  await expect(
    planPublicationObservations({
      ...historical,
      operation: { ...historical.operation, state: 'public' },
    }),
  ).resolves.toEqual([
    expect.objectContaining({ path: '/api/case-content/published/pt', status: 200 }),
  ]);
});
