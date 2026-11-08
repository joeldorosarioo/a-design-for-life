import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { profileDTOSchema } from '@/features/professional-profile';
import { navigationPtFixture, navigationEnFixture } from '../../../../testing/fixtures/content';
import {
  publicRootSchema,
  readPublicRoot,
  withPublicRootWriter,
  type PublicRoot,
} from '@/helpers/payload/public-root';
import { selectCaseStatePresentation } from './select-case-state-presentation';
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (
      !path
        .resolve(directory)
        .startsWith(path.resolve(tmpdir()) + path.sep + 'adfl-case-state-root-')
    )
      throw new Error('Unsafe fixture cleanup.');
    await rm(directory, { recursive: true, force: true });
  }
});
function snapshot(marker: string, locale: 'pt' | 'en' = 'pt'): PublicRoot {
  const navigation = locale === 'pt' ? navigationPtFixture : navigationEnFixture;
  const resumeId = navigation.items[2].destination.href.split('/')[2];
  const profile = profileDTOSchema.parse({
    locale,
    identity: { name: `${marker} CONFIRMED IDENTITY`, role: null },
    home: {
      eyebrow: null,
      title: null,
      titleEmphasis: null,
      description: null,
      projectsLabel: null,
    },
    listing: { eyebrow: null, title: null, description: null },
    contacts: {
      email: `${marker.toLowerCase()}@example.invalid`,
      linkedin: navigation.contacts.linkedin,
    },
    resumeId,
    seo: {
      homeTitle: null,
      homeDescription: null,
      listingTitle: null,
      listingDescription: null,
      aboutTitle: null,
      aboutDescription: null,
    },
  });
  const entry = (value: unknown) => ({
    operationId: randomUUID(),
    targetRevision: randomUUID(),
    value: z.json().parse(value),
  });
  return publicRootSchema.parse({
    generation: randomUUID(),
    subjects: {
      [`professional-profiles/${randomUUID()}`]: entry({ kind: 'profile', locale, profile }),
      [`site-navigation/${randomUUID()}`]: entry({
        kind: 'navigation',
        locale,
        navigation: {
          locale,
          header: {
            brandLabel: `${marker} BRAND`,
            projectsLabel: navigation.items[0].label,
            aboutLabel: navigation.items[1].label,
            resumeLabel: navigation.items[2].label,
            contactLabel: navigation.items[3].label,
          },
          footer: { ...navigation.footer, title: `${marker} FOOTER` },
          controls: navigation.controls,
          messages: {
            notFoundTitle: `${marker} ${locale}404`,
            notFoundDescription: `${marker}404 DESCRIPTION`,
            caseUnavailableTitle: `${marker} ${locale}410`,
            caseUnavailableDescription: `${marker}410 DESCRIPTION`,
            temporaryFailureTitle: `${marker} ${locale}503`,
            temporaryFailureDescription: `${marker}503 DESCRIPTION`,
          },
        },
      }),
    },
  });
}
for (const locale of ['pt', 'en'] as const)
  for (const status of [404, 410, 503] as const)
    it(`selects editable ${locale}/${status} copy and current contacts exclusively from its supplied confirmed root`, async () => {
      const selected = await selectCaseStatePresentation({
        locale,
        status,
        root: snapshot('A', locale),
      });
      expect(selected).toMatchObject({
        locale,
        status,
        title: `A ${locale}${status}`,
        description: `A${status} DESCRIPTION`,
        navigation: {
          brand: { label: 'A BRAND' },
          contacts: { email: 'a@example.invalid' },
          footer: { title: 'A FOOTER' },
        },
      });
      expect(JSON.stringify(selected)).not.toMatch(
        /generation|sitemap|canonical|operationId|targetRevision/,
      );
    });
it('keeps a captured real filesystem root A after current is promoted to B, and allows the next selection to use B', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'adfl-case-state-root-'));
  directories.push(directory);
  await withPublicRootWriter(directory, async (_current, commit) => commit(snapshot('A')));
  const captured = await readPublicRoot(directory);
  await withPublicRootWriter(directory, async (_current, commit) => commit(snapshot('B')));
  expect(
    await selectCaseStatePresentation({ locale: 'pt', status: 404, root: captured }),
  ).toMatchObject({ title: 'A pt404', navigation: { contacts: { email: 'a@example.invalid' } } });
  expect(
    await selectCaseStatePresentation({
      locale: 'pt',
      status: 404,
      root: await readPublicRoot(directory),
    }),
  ).toMatchObject({ title: 'B pt404', navigation: { contacts: { email: 'b@example.invalid' } } });
});
it('returns no editorial presentation for explicit null, a missing locale or incomplete structure without live fallback', async () => {
  expect(await selectCaseStatePresentation({ locale: 'pt', status: 410, root: null })).toBeNull();
  expect(
    await selectCaseStatePresentation({ locale: 'en', status: 404, root: snapshot('A', 'pt') }),
  ).toBeNull();
  const root = snapshot('A');
  delete root.subjects[
    Object.keys(root.subjects).find((key) => key.startsWith('professional-profiles/'))!
  ];
  expect(await selectCaseStatePresentation({ locale: 'pt', status: 503, root })).toBeNull();
});
