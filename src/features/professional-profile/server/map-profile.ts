import 'server-only';
import type { ProfessionalProfile } from '@/payload-types';
import { profileDTOSchema, type ProfileDTO } from '../contracts/profile-dto.schema';
export function mapProfile(document: ProfessionalProfile): ProfileDTO | undefined {
  if (document._status !== 'published') return;
  return profileDTOSchema.parse({
    locale: document.locale,
    identity: { name: document.identity?.name ?? null, role: document.identity?.role ?? null },
    home: {
      eyebrow: document.home?.eyebrow ?? null,
      title: document.home?.title ?? null,
      titleEmphasis: document.home?.titleEmphasis ?? null,
      description: document.home?.description ?? null,
      projectsLabel: document.home?.projectsLabel ?? null,
    },
    listing: {
      eyebrow: document.listing?.eyebrow ?? null,
      title: document.listing?.title ?? null,
      description: document.listing?.description ?? null,
    },
    contacts: {
      email: document.contacts?.email ?? null,
      linkedin: document.contacts?.linkedin ?? null,
    },
    resumeId:
      typeof document.resume === 'object'
        ? (document.resume?.id ?? null)
        : (document.resume ?? null),
    seo: {
      homeTitle: document.seo?.homeTitle ?? null,
      homeDescription: document.seo?.homeDescription ?? null,
      listingTitle: document.seo?.listingTitle ?? null,
      listingDescription: document.seo?.listingDescription ?? null,
      aboutTitle: document.seo?.aboutTitle ?? null,
      aboutDescription: document.seo?.aboutDescription ?? null,
    },
  });
}
