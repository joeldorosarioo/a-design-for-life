import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import type { ProfessionalProfile } from '@/payload-types';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { mapProfile } from '@/features/professional-profile/server';
import {
  navigationFixture,
  profilePublicationFixture,
} from '../../../../testing/fixtures/editorial-lifecycle';
import { resolveTranslatedDestination } from './resolve-translated-destination';
function captured(locale: 'pt' | 'en'): PublicRoot {
  const profile = mapProfile({
    ...profilePublicationFixture(randomUUID(), randomUUID()),
    id: randomUUID(),
    locale,
    _status: 'published',
    createdAt: '',
    updatedAt: '',
  } as unknown as ProfessionalProfile);
  const entry = (value: unknown) => ({
    operationId: randomUUID(),
    targetRevision: randomUUID(),
    value: z.json().parse(value),
  });
  return {
    generation: randomUUID(),
    subjects: {
      [`professional-profiles/${randomUUID()}`]: entry({ kind: 'profile', locale, profile }),
      [`site-navigation/${randomUUID()}`]: entry({
        kind: 'navigation',
        locale,
        navigation: { ...navigationFixture(), locale },
      }),
    },
  };
}
it.each([
  ['home', '/en'],
  ['cases', '/en/cases'],
  ['about', '/en/about'],
] as const)('resolves %s from the explicitly captured target publication', async (kind, href) => {
  expect(
    await resolveTranslatedDestination({
      sourcePage: { kind },
      targetLocale: 'en',
      root: captured('en'),
    }),
  ).toEqual({ ok: true, value: { kind: 'equivalent', href } });
});
it('does not reread current or invent a target when captured target coverage is unavailable', async () => {
  expect(
    await resolveTranslatedDestination({
      sourcePage: { kind: 'about' },
      targetLocale: 'en',
      root: captured('pt'),
    }),
  ).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});
