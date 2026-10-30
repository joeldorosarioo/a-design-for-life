import 'server-only';
import { isDraftOperation } from './editorial-revision';
import {
  ValidationError,
  type CollectionBeforeChangeHook,
  type ValidationFieldError,
} from 'payload';
export type PublicationErrors = ValidationFieldError[];
export function requireText(errors: PublicationErrors, value: unknown, path: string) {
  if (typeof value !== 'string' || !value.trim())
    errors.push({ path, message: 'Preencha este campo antes de publicar.' });
}
export function requireImage(errors: PublicationErrors, value: unknown, path: string) {
  const image = value as { media?: unknown; decorative?: boolean; alt?: string } | null;
  if (!image?.media)
    errors.push({ path: `${path}.media`, message: 'Selecione a imagem antes de publicar.' });
  if (image?.decorative === true) {
    if (image.alt?.trim())
      errors.push({ path: `${path}.alt`, message: 'Imagem decorativa exige alternativa vazia.' });
  } else requireText(errors, image?.alt, `${path}.alt`);
}
export function publicationGuard(
  validate: (data: Record<string, unknown>) => PublicationErrors,
): CollectionBeforeChangeHook {
  return ({ data, originalDoc, req, collection }) => {
    if (data._status !== 'published' || isDraftOperation(req)) return data;
    const errors = validate({ ...originalDoc, ...data });
    if (errors.length) throw new ValidationError({ collection: collection.slug, req, errors });
    return data;
  };
}
