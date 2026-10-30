import { z } from 'zod';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { inputMetadata } from '@/helpers/payload/input-metadata.schema';
const text = z.string().nullish();
export const headerLabelsSchema = z.strictObject({
  brandLabel: text,
  projectsLabel: text,
  aboutLabel: text,
  resumeLabel: text,
  contactLabel: text,
});
export const footerLabelsSchema = z.strictObject({
  eyebrow: text,
  title: text,
  description: text,
  emailLabel: text,
  linkedinLabel: text,
  resumeLabel: text,
  copyright: text,
});
const controlsSchema = z.strictObject({
  homeLabel: text,
  casesLabel: text,
  contentsLabel: text,
  previousSectionLabel: text,
  nextSectionLabel: text,
  openMenuLabel: text,
  closeMenuLabel: text,
  languageLabel: text,
  newTabLabel: text,
  roleLabel: text,
  scopeLabel: text,
});
const messagesSchema = z.strictObject({
  translationUnavailable: text,
  emptyCasesTitle: text,
  emptyCasesDescription: text,
  caseUnavailableTitle: text,
  caseUnavailableDescription: text,
  temporaryFailureTitle: text,
  temporaryFailureDescription: text,
  retryLabel: text,
  notFoundTitle: text,
  notFoundDescription: text,
});
export const navigationInputSchema = z.strictObject({
  ...inputMetadata,
  locale: localeSchema.optional(),
  header: headerLabelsSchema.nullish(),
  footer: footerLabelsSchema.nullish(),
  controls: controlsSchema.nullish(),
  messages: messagesSchema.nullish(),
});
export type NavigationInput = z.infer<typeof navigationInputSchema>;
