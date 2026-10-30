import 'server-only';
import type { Media } from '@/payload-types';
import type { ImageUseInput } from '../contracts/image-use.schema';
import { imageUseDTOSchema, type ImageUseDTO } from '../contracts/image-use-dto.schema';
type StoredImageUse = Omit<ImageUseInput, 'media'> & { media?: string | Media | null };
export function mapImageUse(input?: StoredImageUse | null): ImageUseDTO | undefined {
  if (!input?.media) return;
  return imageUseDTOSchema.parse({
    mediaId: typeof input.media === 'object' ? input.media.id : input.media,
    decorative: input.decorative ?? false,
    alt: input.alt ?? '',
    caption: input.caption ?? null,
  });
}
