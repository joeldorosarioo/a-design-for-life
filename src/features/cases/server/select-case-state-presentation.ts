import 'server-only';
import type { Locale } from '@/helpers/i18n/locale.schema';
import type { PublicRoot } from '@/helpers/payload/public-root';
import { getPublishedProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation, resolveNavigation } from '@/features/site-navigation/server';
import {
  caseStatePresentationSchema,
  type CaseStatePresentation,
} from '../contracts/case-state-presentation.schema';
export type CaseStatePresentationInput = {
  locale: Locale;
  status: 404 | 410 | 503;
  root: PublicRoot | null;
};
/** Read only the supplied confirmed root. Presentation failure never reclassifies route status. */
export async function selectCaseStatePresentation(
  input: CaseStatePresentationInput,
): Promise<CaseStatePresentation | null> {
  if (!input.root) return null;
  try {
    const [profile, navigation] = await Promise.all([
      getPublishedProfile(input.locale, undefined, input.root),
      getPublishedNavigation(input.locale, undefined, input.root),
    ]);
    if (!profile.ok || !navigation.ok) return null;
    const resolved = resolveNavigation({
      locale: input.locale,
      profile: profile.value,
      navigation: navigation.value,
    });
    const messages = navigation.value.messages;
    const english = input.locale === 'en';
    const title =
      input.status === 404
        ? messages?.notFoundTitle
        : input.status === 410
          ? messages?.caseUnavailableTitle
          : messages?.temporaryFailureTitle;
    const description =
      input.status === 404
        ? messages?.notFoundDescription
        : input.status === 410
          ? messages?.caseUnavailableDescription
          : messages?.temporaryFailureDescription;
    return caseStatePresentationSchema.parse({
      locale: input.locale,
      status: input.status,
      navigation: resolved,
      title: title?.trim()
        ? title
        : input.status === 404
          ? english
            ? 'Case not found'
            : 'Case não encontrado'
          : english
            ? 'Case unavailable'
            : 'Case indisponível',
      description: description ?? null,
    });
  } catch {
    return null;
  }
}
