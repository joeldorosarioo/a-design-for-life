import 'server-only';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { profileDTOSchema, type ProfileDTO } from '@/features/professional-profile';
import { navigationDTOSchema, type NavigationDTO } from '../contracts/navigation-dto.schema';
import {
  resolvedNavigationDTOSchema,
  type ResolvedNavigationDTO,
} from '../contracts/resolved-navigation-dto.schema';

export type ResolveNavigationInput = {
  locale: Locale;
  navigation: NavigationDTO;
  profile: ProfileDTO;
};

/** Compose already-confirmed DTOs; this function never reads content or chooses a locale. */
export function resolveNavigation(input: ResolveNavigationInput): ResolvedNavigationDTO {
  const locale = localeSchema.parse(input.locale);
  const navigation = navigationDTOSchema.parse(input.navigation);
  const profile = profileDTOSchema.parse(input.profile);
  if (navigation.locale !== locale || profile.locale !== locale)
    throw new TypeError('Navigation and profile must match the requested locale');
  if (!profile.resumeId || navigation.items[2].destination.mediaId !== profile.resumeId)
    throw new TypeError('Navigation must reference the composed profile resume');
  if (
    navigation.contacts.email !== profile.contacts.email ||
    navigation.contacts.linkedin !== profile.contacts.linkedin
  )
    throw new TypeError('Navigation must reference the composed profile contacts');

  return resolvedNavigationDTOSchema.parse({
    ...navigation,
    contacts: profile.contacts,
    items: [
      navigation.items[0],
      navigation.items[1],
      {
        ...navigation.items[2],
        destination: {
          kind: 'resume',
          href: `/media/${profile.resumeId}/original`,
          newTab: true,
        },
      },
      { ...navigation.items[3], destination: { kind: 'contact', href: '#contact' } },
    ],
  });
}
