import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
import { mapCaseDetail } from '@/features/cases/server';
import { mapProfile } from '@/features/professional-profile/server';
import { withPublicRootWriter, type PublicRoot } from '@/helpers/payload/public-root';
import { createPublicationCoordinator } from '@/helpers/payload/publication-coordinator';
import { installPublicationProvider } from '@/helpers/payload/publication-runtime';
import { readPublishedPortfolio } from './read-published-portfolio';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!directory.startsWith(path.join(tmpdir(), 'e18-portfolio-reader-')))
      throw new Error('Unsafe fixture path');
    await rm(directory, { recursive: true, force: true });
  }
});
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
function snapshot(): PublicRoot {
  const caseId = randomUUID();
  const pt = randomUUID();
  const en = randomUUID();
  return {
    generation: randomUUID(),
    subjects: {
      [`cases/${caseId}`]: entry({ kind: 'case-order', caseId, sortOrder: 0, featured: true }),
      [`case-content/${pt}`]: entry({
        kind: 'case',
        caseId,
        contentId: pt,
        locale: 'pt',
        slug: 'publico',
        slugs: ['antigo', 'publico'],
        detail: mapCaseDetail({
          id: pt,
          case: caseId,
          locale: 'pt',
          slug: 'publico',
          title: 'Título',
          titleEmphasis: 'confirmado',
          _status: 'published',
          createdAt: '',
          updatedAt: '',
        }),
      }),
      [`case-content/${en}`]: entry({
        kind: 'case',
        caseId,
        contentId: en,
        locale: 'en',
        slug: 'confirmed',
        slugs: ['confirmed'],
        detail: mapCaseDetail({
          id: en,
          case: caseId,
          locale: 'en',
          slug: 'confirmed',
          title: 'Confirmed English',
          _status: 'published',
          createdAt: '',
          updatedAt: '',
        }),
      }),
      [`professional-profiles/${randomUUID()}`]: entry({
        kind: 'profile',
        locale: 'pt',
        profile: mapProfile({
          id: randomUUID(),
          locale: 'pt',
          _status: 'published',
          identity: { name: 'Confirmed profile' },
          contacts: { email: 'confirmed@example.invalid' },
          createdAt: '',
          updatedAt: '',
        }),
      }),
      [`site-navigation/${randomUUID()}`]: entry({
        kind: 'navigation',
        locale: 'pt',
        navigation: { locale: 'pt', header: { brandLabel: 'Confirmed brand' } },
      }),
    },
  };
}
it('compõe cards, destaque, contagem, SEO, canonical, alternates e histórico de uma única geração', async () => {
  const root = snapshot();
  expect(await readPublishedPortfolio('pt', root)).toMatchObject({
    ok: true,
    value: {
      generation: root.generation,
      count: 1,
      profile: { identity: { name: 'Confirmed profile' } },
      navigation: {
        brand: { label: 'Confirmed brand' },
        contacts: { email: 'confirmed@example.invalid' },
      },
      cases: [{ title: 'Título confirmado' }],
      featured: [{ title: 'Título confirmado' }],
      routes: [
        {
          path: '/pt/cases/publico',
          canonical: '/pt/cases/publico',
          history: ['/pt/cases/antigo'],
          seo: { title: 'Título confirmado' },
          alternates: { pt: '/pt/cases/publico', en: '/en/cases/confirmed' },
        },
        { path: '/en/cases/confirmed' },
      ],
      sitemap: ['/pt', '/pt/cases', '/pt/sobre', '/pt/cases/publico', '/en/cases/confirmed'],
    },
  });
});
it('lê o arquivo real uma vez e permite manter uma geração explícita mesmo após outra ser confirmada', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'e18-portfolio-reader-'));
  directories.push(directory);
  installPublicationProvider(() =>
    createPublicationCoordinator({
      directory,
      compose: async () => {
        throw new Error('No writes in reader fixture');
      },
    }),
  );
  const old = snapshot();
  await withPublicRootWriter(directory, async (_, commit) => commit(old));
  expect(await readPublishedPortfolio('pt')).toMatchObject({
    ok: true,
    value: { generation: old.generation },
  });
  const current = snapshot();
  await withPublicRootWriter(directory, async (_, commit) => commit(current));
  expect(await readPublishedPortfolio('pt', old)).toMatchObject({
    ok: true,
    value: { generation: old.generation },
  });
  expect(await readPublishedPortfolio('pt')).toMatchObject({
    ok: true,
    value: { generation: current.generation },
  });
  await writeFile(path.join(directory, 'current.json'), '{corrupt');
  expect(await readPublishedPortfolio('pt')).toMatchObject({
    ok: false,
    error: { code: 'unavailable' },
  });
  expect(await readPublishedPortfolio('pt', old)).toMatchObject({
    ok: true,
    value: { generation: old.generation },
  });
});
it('não converte cache ausente ou sem cobertura em portfolio vazio', async () => {
  for (const root of [null, { generation: randomUUID(), subjects: {} }])
    expect(await readPublishedPortfolio('pt', root)).toMatchObject({
      ok: false,
      error: { code: 'unavailable' },
    });
});

it('vincula todos os consumidores ao primeiro root real mesmo se o provider mudar no próximo acesso', async () => {
  const firstDirectory = await mkdtemp(path.join(tmpdir(), 'e18-portfolio-reader-'));
  directories.push(firstDirectory);
  const secondDirectory = await mkdtemp(path.join(tmpdir(), 'e18-portfolio-reader-'));
  directories.push(secondDirectory);
  const first = snapshot();
  const second = snapshot();
  await withPublicRootWriter(firstDirectory, async (_, commit) => commit(first));
  await withPublicRootWriter(secondDirectory, async (_, commit) => commit(second));
  let accesses = 0;
  installPublicationProvider(() =>
    createPublicationCoordinator({
      directory: accesses++ === 0 ? firstDirectory : secondDirectory,
      compose: async () => {
        throw new Error('Reader fixture never writes');
      },
    }),
  );
  const result = await readPublishedPortfolio('pt');
  const firstCaseId = Object.keys(first.subjects)
    .find((key) => key.startsWith('cases/'))!
    .slice('cases/'.length);
  expect(result).toMatchObject({
    ok: true,
    value: {
      generation: first.generation,
      cases: [{ caseId: firstCaseId }],
      featured: [{ caseId: firstCaseId }],
      routes: [{ caseId: firstCaseId }, { caseId: firstCaseId }],
    },
  });
  expect(accesses).toBe(1);
});
