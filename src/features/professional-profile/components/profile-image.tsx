import Image from 'next/image';
import type { ImageUseDTO } from '@/features/media-library';

type ProfileImageProps = {
  image: ImageUseDTO | null;
  kind: 'portrait' | 'about-portrait' | 'desk' | 'architecture';
  /** Previews keep authenticated bytes out of the anonymous image optimizer. */
  mediaMode?: 'published' | 'preview';
};

const dimensions = {
  portrait: {
    width: 480,
    height: 528,
    className: 'max-w-[30rem] aspect-[342/384] lg:aspect-[480/528]',
  },
  'about-portrait': { width: 480, height: 600, className: 'max-w-[30rem] aspect-[4/5]' },
  desk: { width: 1280, height: 720, className: 'aspect-[16/9]' },
  architecture: { width: 480, height: 640, className: 'max-w-[30rem] aspect-[3/4]' },
} as const;

export function ProfileImage({ image, kind, mediaMode = 'published' }: ProfileImageProps) {
  if (!image) return null;
  const { width, height, className } = dimensions[kind];
  return (
    <figure className="min-w-0">
      <Image
        className={`block h-auto w-full object-cover object-center ${className}`}
        src={`/${mediaMode === 'preview' ? 'preview-media' : 'media'}/${image.mediaId}/original`}
        alt={image.decorative ? '' : image.alt}
        width={width}
        height={height}
        sizes={
          kind === 'desk'
            ? '(min-width: 1328px) 1280px, calc(100vw - 48px)'
            : '(min-width: 1024px) 480px, (min-width: 528px) 480px, calc(100vw - 48px)'
        }
        unoptimized={mediaMode === 'preview'}
      />
      {image.caption ? (
        <figcaption className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
