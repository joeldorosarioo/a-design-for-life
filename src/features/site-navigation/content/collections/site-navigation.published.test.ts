import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { mapProfile } from '@/features/professional-profile/server';
import { SiteNavigation } from './site-navigation';
import {
  publicEndpointRequest,
  publishedFixtureEntry,
  publishedLocaleHandler,
  withPublishedEndpointRoot,
} from '../../../../../testing/fixtures/published-root-endpoint';

it('marks navigation JSON from the same root as its confirmed profile dependency', async () => {
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
            contacts: { email: 'confirmed@example.invalid' },
            resume: randomUUID(),
            createdAt: '',
            updatedAt: '',
          }),
        }),
        [`site-navigation/${randomUUID()}`]: publishedFixtureEntry({
          kind: 'navigation',
          locale: 'pt',
          navigation: { locale: 'pt', header: { brandLabel: 'Confirmed brand' } },
        }),
      },
    });
    const response = await publishedLocaleHandler(SiteNavigation)!(publicEndpointRequest('pt'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-portfolio-generation')).toBe(generation);
    expect(await response.json()).toMatchObject({
      ok: true,
      value: { contacts: { email: 'confirmed@example.invalid' } },
    });
    expect(selections()).toBe(1);
  });
});
