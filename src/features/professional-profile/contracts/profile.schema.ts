import { nativeArray } from '@/helpers/payload/native-array.schema';
import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { inputMetadata } from '@/helpers/payload/input-metadata.schema';
import { imageUseInputSchema } from '@/features/media-library';
const text = z.string().nullish();
const row = { id: z.string().nullish(), readingKey: z.uuid().nullish() };
const linkedin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    ['linkedin.com', 'www.linkedin.com'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
}, 'Informe um endereço HTTPS do LinkedIn.');
export const profileInputSchema = z.strictObject({
  ...inputMetadata,
  locale: localeSchema.optional(),
  identity: z.strictObject({ name: text, role: text }).nullish(),
  home: z
    .strictObject({
      eyebrow: text,
      title: text,
      titleEmphasis: text,
      description: text,
      portrait: imageUseInputSchema.nullish(),
      projectsLabel: text,
    })
    .nullish(),
  homeProjects: z.strictObject({ eyebrow: text, title: text, description: text }).nullish(),
  listing: z.strictObject({ eyebrow: text, title: text, description: text }).nullish(),
  homeAbout: z
    .strictObject({
      eyebrow: text,
      title: text,
      description: text,
      trajectory: nativeArray(
        z.strictObject({ ...row, period: text, title: text, description: text }),
      ).nullish(),
      aboutLabel: text,
    })
    .nullish(),
  approach: z
    .strictObject({
      eyebrow: text,
      title: text,
      description: text,
      methods: nativeArray(z.strictObject({ ...row, title: text, description: text })).nullish(),
    })
    .nullish(),
  about: z
    .strictObject({
      eyebrow: text,
      title: text,
      description: text,
      introductionHeading: text,
      introduction: text,
      portrait: imageUseInputSchema.nullish(),
      journeyHeading: text,
      journey: text,
      deskPhotograph: imageUseInputSchema.nullish(),
      editorialEmphasis: text,
      approachHeading: text,
      approach: text,
      architecturePhotograph: imageUseInputSchema.nullish(),
      inMotionHeading: text,
      inMotion: text,
      closingHeading: text,
      closing: text,
      projectsLabel: text,
    })
    .nullish(),
  contacts: z
    .strictObject({
      email: z.union([z.literal(''), z.email()]).nullish(),
      linkedin: z.union([z.literal(''), linkedin]).nullish(),
    })
    .nullish(),
  resume: z.uuid().nullish(),
  seo: z
    .strictObject({
      homeTitle: text,
      homeDescription: text,
      listingTitle: text,
      listingDescription: text,
      aboutTitle: text,
      aboutDescription: text,
      image: imageUseInputSchema.nullish(),
    })
    .nullish(),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
