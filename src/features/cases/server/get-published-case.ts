import 'server-only';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import type { PublicRoot } from '@/helpers/payload/public-root';
import type { Result } from '@/helpers/payload/editorial-result.schema';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import type { ImageUseDTO } from '@/features/media-library';
import { readConfirmedCaseEntries } from './get-published-cases';
export async function getPublishedCase(
  locale: Locale,
  slug: string,
  generation?: PublicRoot | null,
): Promise<Result<CaseDetailDTO>> {
  try {
    const language = localeSchema.parse(locale);
    const { cases } = await readConfirmedCaseEntries(generation);
    const confirmed = cases.find((item) => item.locale === language && item.slug === slug);
    const value = confirmed?.detail;
    if (value) {
      const sizes = new Map(
        confirmed.media
          .filter(({ manifest }) => manifest.kind === 'image')
          .map(({ id, manifest }) => [id, manifest.original]),
      );
      const withSize = (image: ImageUseDTO | null) => {
        const original = image && sizes.get(image.mediaId);
        return image && original?.width && original.height
          ? { ...image, intrinsicSize: { width: original.width, height: original.height } }
          : image;
      };
      const cover = value.cover && sizes.get(value.cover.mediaId);
      const width = cover?.width;
      const height = cover?.height;
      const sections = value.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.type === 'image'
            ? { ...block, image: withSize(block.image) }
            : block.type === 'image-pair'
              ? { ...block, first: withSize(block.first), second: withSize(block.second) }
              : block,
        ),
      }));
      return {
        ok: true,
        value: {
          ...value,
          sections,
          ...(width && height ? { coverIntrinsicSize: { width, height } } : {}),
        },
      };
    }
  } catch {
    /* Missing/corrupt coverage is unavailable, never proof of absence. */
  }
  return { ok: false, error: { code: 'unavailable', message: 'Confirmed case unavailable.' } };
}
