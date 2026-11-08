import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { mapProfile } from './map-profile';
import { getPublishedProfile } from './get-published-profile';
const entry = (value: unknown) => ({
  operationId: randomUUID(),
  targetRevision: randomUUID(),
  value: z.json().parse(value),
});
it('projeta o perfil confirmado e rejeita chave/idioma inconsistentes sem consultar Native', async () => {
  const value = {
    kind: 'profile',
    locale: 'pt',
    profile: mapProfile({
      id: randomUUID(),
      locale: 'pt',
      _status: 'published',
      identity: { name: 'Confirmed profile' },
      createdAt: '',
      updatedAt: '',
    }),
  };
  const root = {
    generation: randomUUID(),
    subjects: { [`professional-profiles/${randomUUID()}`]: entry(value) },
  };
  expect(await getPublishedProfile('pt', undefined, root)).toMatchObject({
    ok: true,
    value: { identity: { name: 'Confirmed profile' } },
  });
  expect(await getPublishedProfile('en', undefined, root)).toMatchObject({
    ok: false,
    error: { code: 'unavailable' },
  });
  expect(
    await getPublishedProfile('pt', undefined, {
      ...root,
      subjects: { 'professional-profiles/invalid': entry(value) },
    }),
  ).toMatchObject({ ok: false, error: { code: 'unavailable' } });
});
