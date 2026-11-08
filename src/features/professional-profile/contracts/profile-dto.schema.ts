import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { imageUseDTOSchema } from '@/features/media-library';
import { profileContactsSchema } from './profile-contacts.schema';

const text = z.string().nullable();
const heading = z.object({ eyebrow: text, title: text, description: text });
const emptyHeading = { eyebrow: null, title: null, description: null };
const readingKey = z.uuid().nullable();
const image = imageUseDTOSchema.nullable();
const about = z.object({
  eyebrow: text,
  title: text,
  description: text,
  introductionHeading: text,
  introduction: text,
  portrait: image,
  journeyHeading: text,
  journey: text,
  deskPhotograph: image,
  editorialEmphasis: text,
  approachHeading: text,
  approach: text,
  architecturePhotograph: image,
  inMotionHeading: text,
  inMotion: text,
  closingHeading: text,
  closing: text,
  projectsLabel: text,
});
const emptyAbout = {
  eyebrow: null,
  title: null,
  description: null,
  introductionHeading: null,
  introduction: null,
  portrait: null,
  journeyHeading: null,
  journey: null,
  deskPhotograph: null,
  editorialEmphasis: null,
  approachHeading: null,
  approach: null,
  architecturePhotograph: null,
  inMotionHeading: null,
  inMotion: null,
  closingHeading: null,
  closing: null,
  projectsLabel: null,
};

export const profileDTOSchema = z.object({
  locale: localeSchema,
  identity: z.object({ name: text, role: text }),
  home: z.object({
    eyebrow: text,
    title: text,
    titleEmphasis: text,
    description: text,
    projectsLabel: text,
    portrait: image.default(null),
  }),
  homeProjects: heading.default(emptyHeading),
  listing: heading,
  homeAbout: heading
    .extend({
      trajectory: z.array(z.object({ readingKey, period: text, title: text, description: text })),
      aboutLabel: text,
    })
    .default(() => ({ ...emptyHeading, trajectory: [], aboutLabel: null })),
  approach: heading
    .extend({
      methods: z.array(z.object({ readingKey, title: text, description: text })),
    })
    .default(() => ({ ...emptyHeading, methods: [] })),
  about: about.default(emptyAbout),
  contacts: profileContactsSchema,
  resumeId: z.uuid().nullable(),
  seo: z.object({
    homeTitle: text,
    homeDescription: text,
    listingTitle: text,
    listingDescription: text,
    aboutTitle: text,
    aboutDescription: text,
    image: image.default(null),
  }),
});
export type ProfileDTO = z.infer<typeof profileDTOSchema>;
