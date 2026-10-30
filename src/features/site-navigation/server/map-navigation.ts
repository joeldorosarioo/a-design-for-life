import 'server-only';
import type { SiteNavigation } from '@/payload-types';
import type { ProfileDTO } from '@/features/professional-profile';
import { navigationDTOSchema, type NavigationDTO } from '../contracts/navigation-dto.schema';
export function mapNavigation(
  document: SiteNavigation,
  profile?: ProfileDTO,
): NavigationDTO | undefined {
  if (document._status !== 'published' || !profile || document.locale !== profile.locale) return;
  const locale = document.locale;
  return navigationDTOSchema.parse({
    locale,
    brand: { label: document.header?.brandLabel ?? null, href: `/${locale}` },
    items: [
      {
        purpose: 'projects',
        label: document.header?.projectsLabel ?? null,
        destination: { kind: 'page', href: `/${locale}/cases` },
      },
      {
        purpose: 'about',
        label: document.header?.aboutLabel ?? null,
        destination: { kind: 'page', href: locale === 'pt' ? '/pt/sobre' : '/en/about' },
      },
      {
        purpose: 'resume',
        label: document.header?.resumeLabel ?? null,
        destination: { kind: 'resume', mediaId: profile.resumeId, newTab: true },
      },
      {
        purpose: 'contact',
        label: document.header?.contactLabel ?? null,
        destination: { kind: 'contact', anchor: '#contact' },
      },
    ],
    footer: document.footer,
    controls: document.controls,
    messages: document.messages,
    contacts: profile.contacts,
  });
}
