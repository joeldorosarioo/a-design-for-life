import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { ProfessionalProfiles } from './professional-profiles';
import { mapProfile } from '../../server/map-profile';
import {
  publicEndpointRequest,
  publishedFixtureEntry,
  publishedLocaleHandler,
  withPublishedEndpointRoot,
} from '../../../../../testing/fixtures/published-root-endpoint';

it('marks the anonymous profile JSON with the generation that supplies its public fields', async () => {
  await withPublishedEndpointRoot(async ({ write, selections }) => {
    const id = randomUUID();
    const generation = randomUUID();
    await write({
      generation,
      subjects: {
        [`professional-profiles/${id}`]: publishedFixtureEntry({
          kind: 'profile',
          locale: 'pt',
          profile: mapProfile({
            id,
            locale: 'pt',
            _status: 'published',
            identity: { name: 'Confirmed profile' },
            createdAt: '',
            updatedAt: '',
          }),
        }),
      },
    });
    const response = await publishedLocaleHandler(ProfessionalProfiles)!(
      publicEndpointRequest('pt'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-portfolio-generation')).toBe(generation);
    expect(await response.json()).toMatchObject({
      ok: true,
      value: { identity: { name: 'Confirmed profile' } },
    });
    expect(selections()).toBe(1);
  });
});

it('keeps invalid locale at 404 and unavailable coverage at 503 without a generation marker', async () => {
  await withPublishedEndpointRoot(async ({ selections }) => {
    const handler = publishedLocaleHandler(ProfessionalProfiles)!;
    const invalid = await handler(publicEndpointRequest('fr'));
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get('x-portfolio-generation')).toBeNull();
    expect(selections()).toBe(0);
    const missing = await handler(publicEndpointRequest('pt'));
    expect(missing.status).toBe(503);
    expect(missing.headers.get('x-portfolio-generation')).toBeNull();
  });
});
