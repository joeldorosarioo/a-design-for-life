import 'server-only';
import type { Payload } from 'payload';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { runtimePublication } from '@/helpers/payload/publication-runtime';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import { profileDTOSchema, type ProfileDTO } from '../contracts/profile-dto.schema';
const snapshotSchema = z.object({
  kind: z.literal('profile'),
  locale: localeSchema,
  profile: profileDTOSchema,
});
export async function getPublishedProfile(
  locale: Locale,
  _legacyPayload?: Payload,
  generation?: PublicRoot | null,
): Promise<Result<ProfileDTO>> {
  try {
    const language = localeSchema.parse(locale);
    const root =
      generation === undefined ? await readPublicRoot(runtimePublication().directory) : generation;
    if (!root || !z.uuid().safeParse(root.generation).success)
      throw new Error('Confirmed profile unavailable.');
    const profiles = Object.entries(root.subjects)
      .filter(([key]) => key.startsWith('professional-profiles/'))
      .map(([key, entry]) => {
        z.uuid().parse(key.slice('professional-profiles/'.length));
        return snapshotSchema.parse(entry.value);
      });
    if (profiles.some((item) => item.locale !== item.profile.locale))
      throw new Error('Confirmed profile locale mismatch.');
    const matches = profiles.filter((item) => item.locale === language);
    if (matches.length === 1) return { ok: true, value: matches[0].profile };
  } catch {
    /* Origin state cannot replace a missing/corrupt confirmed generation. */
  }
  return { ok: false, error: { code: 'unavailable', message: 'Confirmed profile unavailable.' } };
}
