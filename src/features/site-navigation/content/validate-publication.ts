import 'server-only';
import {
  publicationGuard,
  requireText,
  type PublicationErrors,
} from '@/helpers/payload/publication-validation';
import { navigationInputSchema } from '../contracts/navigation.schema';
export const validateNavigationPublication = publicationGuard((data) => {
  const errors: PublicationErrors = [];
  for (const group of ['header', 'footer', 'controls', 'messages'] as const) {
    const schema = navigationInputSchema.shape[group].unwrap().unwrap();
    for (const key of Object.keys(schema.shape))
      requireText(
        errors,
        (data[group] as Record<string, unknown> | undefined)?.[key],
        `${group}.${key}`,
      );
  }
  return errors;
});
