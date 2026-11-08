import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { mapProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation } from './get-published-navigation';
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
it('compõe contatos e currículo do perfil confirmado na mesma geração e exige a dependência', async () => {
  const pdf = randomUUID();
  const profileKey = `professional-profiles/${randomUUID()}`;
  const navKey = `site-navigation/${randomUUID()}`;
  const profile = mapProfile({
    id: randomUUID(),
    locale: 'pt',
    _status: 'published',
    contacts: { email: 'confirmed@example.invalid' },
    resume: pdf,
    createdAt: '',
    updatedAt: '',
  });
  const root = {
    generation: randomUUID(),
    subjects: {
      [profileKey]: entry({ kind: 'profile', locale: 'pt', profile }),
      [navKey]: entry({
        kind: 'navigation',
        locale: 'pt',
        navigation: { locale: 'pt', header: { brandLabel: 'Confirmed brand' } },
      }),
    },
  };
  expect(await getPublishedNavigation('pt', undefined, root)).toMatchObject({
    ok: true,
    value: {
      contacts: { email: 'confirmed@example.invalid' },
      items: [
        { purpose: 'projects' },
        { purpose: 'about' },
        { purpose: 'resume', destination: { mediaId: pdf } },
        { purpose: 'contact' },
      ],
    },
  });
  expect(
    await getPublishedNavigation('pt', undefined, {
      ...root,
      subjects: { [navKey]: root.subjects[navKey] },
    }),
  ).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});
