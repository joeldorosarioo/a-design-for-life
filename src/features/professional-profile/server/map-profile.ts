import 'server-only';
import type { ProfessionalProfile } from '@/payload-types';
import { mapImageUse } from '@/features/media-library/server';
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
      portrait: mapImageUse(document.home?.portrait) ?? null,
    },
    homeProjects: {
      eyebrow: document.homeProjects?.eyebrow ?? null,
      title: document.homeProjects?.title ?? null,
      description: document.homeProjects?.description ?? null,
    },
    listing: {
      eyebrow: document.listing?.eyebrow ?? null,
      title: document.listing?.title ?? null,
      description: document.listing?.description ?? null,
    },
    homeAbout: {
      eyebrow: document.homeAbout?.eyebrow ?? null,
      title: document.homeAbout?.title ?? null,
      description: document.homeAbout?.description ?? null,
      trajectory: (document.homeAbout?.trajectory ?? []).map((row) => ({
        readingKey: row.readingKey ?? null,
        period: row.period ?? null,
        title: row.title ?? null,
        description: row.description ?? null,
      })),
      aboutLabel: document.homeAbout?.aboutLabel ?? null,
    },
    approach: {
      eyebrow: document.approach?.eyebrow ?? null,
      title: document.approach?.title ?? null,
      description: document.approach?.description ?? null,
      methods: (document.approach?.methods ?? []).map((row) => ({
        readingKey: row.readingKey ?? null,
        title: row.title ?? null,
        description: row.description ?? null,
      })),
    },
    about: {
      eyebrow: document.about?.eyebrow ?? null,
      title: document.about?.title ?? null,
      description: document.about?.description ?? null,
      introductionHeading: document.about?.introductionHeading ?? null,
      introduction: document.about?.introduction ?? null,
      portrait: mapImageUse(document.about?.portrait) ?? null,
      journeyHeading: document.about?.journeyHeading ?? null,
      journey: document.about?.journey ?? null,
      deskPhotograph: mapImageUse(document.about?.deskPhotograph) ?? null,
      editorialEmphasis: document.about?.editorialEmphasis ?? null,
      approachHeading: document.about?.approachHeading ?? null,
      approach: document.about?.approach ?? null,
      architecturePhotograph: mapImageUse(document.about?.architecturePhotograph) ?? null,
      inMotionHeading: document.about?.inMotionHeading ?? null,
      inMotion: document.about?.inMotion ?? null,
      closingHeading: document.about?.closingHeading ?? null,
      closing: document.about?.closing ?? null,
      projectsLabel: document.about?.projectsLabel ?? null,
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
      image: mapImageUse(document.seo?.image) ?? null,
    },
  });
}
