import 'server-only';
import type { Payload } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { getPublishedProfile } from '@/features/professional-profile/server';
import type { NavigationDTO } from '../contracts/navigation-dto.schema';
import { navigationInputSchema } from '../contracts/navigation.schema';
import { mapNavigation } from './map-navigation';
const snapshotSchema = z.object({
  kind: z.literal('navigation'),
  locale: localeSchema,
  navigation: navigationInputSchema,
});
export async function getPublishedNavigation(
  locale: Locale,
  _legacyPayload?: Payload,
  generation?: PublicRoot | null,
): Promise<Result<NavigationDTO>> {
  try {
    const language = localeSchema.parse(locale);
    const root =
      generation === undefined ? await readPublicRoot(runtimePublication().directory) : generation;
    if (!root || !z.uuid().safeParse(root.generation).success)
      throw new Error('Confirmed generation unavailable.');
    const snapshots = Object.entries(root.subjects)
      .filter(([key]) => key.startsWith('site-navigation/'))
      .map(([key, entry]) => ({
        id: z.uuid().parse(key.slice('site-navigation/'.length)),
        ...snapshotSchema.parse(entry.value),
      }));
    if (snapshots.some((item) => item.locale !== item.navigation.locale))
      throw new Error('Navigation locale mismatch.');
    const matches = snapshots.filter((item) => item.locale === language);
    const profile = await getPublishedProfile(language, undefined, root);
    if (matches.length !== 1 || !profile.ok) throw new Error('Confirmed dependencies unavailable.');
    const { id, navigation } = matches[0];
    const value = mapNavigation(
      {
        id,
        locale: language,
        _status: 'published',
        createdAt: '',
        updatedAt: '',
        header: navigation.header ?? undefined,
        footer: navigation.footer ?? undefined,
        controls: navigation.controls ?? undefined,
        messages: navigation.messages ?? undefined,
      },
      profile.value,
    );
    if (value) return { ok: true, value };
  } catch {
    /* Never fetch a live body to fill a confirmed generation. */
  }
  return {
    ok: false,
    error: { code: 'unavailable', message: 'Confirmed navigation unavailable.' },
  };
}
