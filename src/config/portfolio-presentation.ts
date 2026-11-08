import type { Locale } from '@/helpers/i18n/locale.schema';
import type { ProfileDTO } from '@/features/professional-profile';
import type { NavigationDTO } from '@/features/site-navigation';
import type { CaseCardDTO } from '@/features/cases';

/** Presentation input only. Publication identity and SEO authority stay outside the frame. */
export type PortfolioPresentation = {
  locale: Locale;
  profile: ProfileDTO;
  navigation: NavigationDTO;
  cases: CaseCardDTO[];
  featured: CaseCardDTO[];
  routes: { caseId: string; locale: Locale; path: string }[];
};
