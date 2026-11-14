import Image from 'next/image';
import { cva } from 'class-variance-authority';
import type { ImageUseDTO } from '@/features/media-library';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseCoverMotion } from './case-view-motion';
export type CaseMediaMode = 'published' | 'preview';
const dimensions = {
  cover: { width: 1280, height: 480 },
  card: { width: 624, height: 352 },
  article: { width: 1008, height: 567 },
  pair: { width: 488, height: 275 },
} as const;
const sizes = {
  cover: '(min-width: 1328px) 1280px, calc(100vw - 48px)',
  card: '(min-width: 1328px) 624px, (min-width: 768px) calc((100vw - 80px) / 2), calc(100vw - 48px)',
  article:
    '(min-width: 1328px) 1008px, (min-width: 1024px) calc(100vw - 320px), calc(100vw - 48px)',
  pair: '(min-width: 1328px) 488px, (min-width: 1024px) calc((100vw - 352px) / 2), (min-width: 768px) calc((100vw - 80px) / 2), calc(100vw - 48px)',
} as const;
function containedCoverSizes({ width, height }: NonNullable<CaseDetailDTO['coverIntrinsicSize']>) {
  // Match the mobile and desktop slot ratios in imageVariants. A contained
  // portrait paints less than the width of its slot, while the slot stays fixed.
  const aspectRatio = width / height;
  const desktop = Math.min(1, (aspectRatio * dimensions.cover.height) / dimensions.cover.width);
  const mobile = Math.min(1, (aspectRatio * 192) / 342);
  if (desktop === 1 && mobile === 1) return sizes.cover;
  const scaled = (fraction: number) =>
    fraction === 1 ? 'calc(100vw - 48px)' : `calc((100vw - 48px) * ${fraction.toFixed(5)})`;
  return `(min-width: 1328px) ${Math.ceil(dimensions.cover.width * desktop)}px, (min-width: 1024px) ${scaled(desktop)}, ${scaled(mobile)}`;
}
const imageVariants = cva('block h-auto w-full max-w-full rounded-xl', {
  variants: {
    kind: {
      cover: 'aspect-[342/192] object-contain lg:aspect-[1280/480]',
      card: 'aspect-[342/192] object-cover lg:aspect-[624/352]',
      article: 'object-contain',
      pair: 'object-contain',
    },
    coverPresentation: {
      'contained-cherry': null,
      'contained-soft': null,
    },
  },
  compoundVariants: [
    { kind: 'cover', coverPresentation: 'contained-cherry', class: 'bg-primary' },
    { kind: 'cover', coverPresentation: 'contained-soft', class: 'bg-muted' },
  ],
  defaultVariants: { kind: 'article', coverPresentation: 'contained-cherry' },
});
export function CaseImage({
  image,
  kind = 'article',
  mediaMode = 'published',
  priority = false,
  coverPresentation,
  intrinsicSize,
  transitionName,
}: {
  image: ImageUseDTO | null;
  kind?: keyof typeof dimensions;
  mediaMode?: CaseMediaMode;
  priority?: boolean;
  coverPresentation?: CaseDetailDTO['coverPresentation'] | null;
  intrinsicSize?: CaseDetailDTO['coverIntrinsicSize'];
  transitionName?: string;
}) {
  if (!image) return null;
  // shortcut: legacy images keep a contained fixed slot until their intrinsic dimensions are available.
  const naturalSize = kind === 'article' || kind === 'pair' ? image.intrinsicSize : undefined;
  const picture = (
    <Image
      className={imageVariants({
        kind,
        coverPresentation: coverPresentation ?? 'contained-cherry',
        className: transitionName
          ? '[view-transition-class:case-cover]'
          : !naturalSize && kind === 'article'
            ? 'aspect-[1008/567]'
            : !naturalSize && kind === 'pair'
              ? 'aspect-[488/275]'
              : undefined,
      })}
      src={`/${mediaMode === 'preview' ? 'preview-media' : 'media'}/${image.mediaId}/original`}
      alt={image.decorative ? '' : image.alt}
      {...(naturalSize ?? dimensions[kind])}
      sizes={kind === 'cover' && intrinsicSize ? containedCoverSizes(intrinsicSize) : sizes[kind]}
      unoptimized={mediaMode === 'preview'}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
    />
  );
  return (
    <figure className="m-0 min-w-0">
      {transitionName ? (
        <CaseCoverMotion name={transitionName}>{picture}</CaseCoverMotion>
      ) : (
        picture
      )}
      {image.caption ? (
        <figcaption className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
