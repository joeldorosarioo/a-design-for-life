import Image from 'next/image';
import type { ImageUseDTO } from '@/features/media-library';
import styles from '../stylesheets/profile-image.module.css';

type ProfileImageProps = {
  image: ImageUseDTO | null;
  kind: 'portrait' | 'about-portrait' | 'desk' | 'architecture';
  /** Previews keep authenticated bytes out of the anonymous image optimizer. */
  mediaMode?: 'published' | 'preview';
};

const dimensions = {
  portrait: { width: 480, height: 528 },
  'about-portrait': { width: 480, height: 600 },
  desk: { width: 1280, height: 720 },
  architecture: { width: 480, height: 640 },
} as const;

export function ProfileImage({ image, kind, mediaMode = 'published' }: ProfileImageProps) {
  if (!image) return null;
  return (
    <figure className={styles.figure}>
      <Image
        className={styles[kind]}
        src={`/${mediaMode === 'preview' ? 'preview-media' : 'media'}/${image.mediaId}/original`}
        alt={image.decorative ? '' : image.alt}
        width={dimensions[kind].width}
        height={dimensions[kind].height}
        sizes={
          kind === 'desk'
            ? '(min-width: 1328px) 1280px, calc(100vw - 48px)'
            : '(min-width: 1024px) 480px, (min-width: 528px) 480px, calc(100vw - 48px)'
        }
        unoptimized={mediaMode === 'preview'}
      />
      {image.caption ? <figcaption className={styles.caption}>{image.caption}</figcaption> : null}
    </figure>
  );
}
