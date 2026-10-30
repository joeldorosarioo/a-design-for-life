import 'server-only';
import {
  publicationGuard,
  requireImage,
  requireText,
  type PublicationErrors,
} from '@/helpers/payload/publication-validation';
import { profileInputSchema } from '../contracts/profile.schema';
export const validateProfilePublication = publicationGuard((data) => {
  const errors: PublicationErrors = [];
  for (const group of [
    'identity',
    'home',
    'homeProjects',
    'listing',
    'homeAbout',
    'approach',
    'about',
    'contacts',
  ] as const) {
    const schema = profileInputSchema.shape[group].unwrap().unwrap();
    for (const key of Object.keys(schema.shape)) {
      if (
        [
          'titleEmphasis',
          'portrait',
          'deskPhotograph',
          'architecturePhotograph',
          'trajectory',
          'methods',
        ].includes(key)
      )
        continue;
      requireText(
        errors,
        (data[group] as Record<string, unknown> | undefined)?.[key],
        `${group}.${key}`,
      );
    }
  }
  const home = data.home as Record<string, unknown> | undefined;
  const about = data.about as Record<string, unknown> | undefined;
  requireImage(errors, home?.portrait, 'home.portrait');
  for (const field of ['portrait', 'deskPhotograph', 'architecturePhotograph'])
    requireImage(errors, about?.[field], `about.${field}`);
  requireText(
    errors,
    typeof data.resume === 'object' ? (data.resume as { id?: unknown })?.id : data.resume,
    'resume',
  );
  for (const [group, key] of [
    ['homeAbout', 'trajectory'],
    ['approach', 'methods'],
  ]) {
    const rows = (data[group] as Record<string, unknown> | undefined)?.[key];
    if (!Array.isArray(rows) || !rows.length)
      errors.push({
        path: `${group}.${key}`,
        message: 'Adicione ao menos um item antes de publicar.',
      });
    else
      rows.forEach((row, index) => {
        for (const field of key === 'methods'
          ? ['title', 'description']
          : ['period', 'title', 'description'])
          requireText(errors, row[field], `${group}.${key}.${index}.${field}`);
      });
  }
  return errors;
});
