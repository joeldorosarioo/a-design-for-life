import Image from 'next/image';
import type { ImageUseDTO } from '@/features/media-library';
import styles from '../stylesheets/cases.module.css';
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
export function CaseImage({
  image,
  kind = 'article',
  mediaMode = 'published',
  priority = false,
}: {
  image: ImageUseDTO | null;
  kind?: keyof typeof dimensions;
  mediaMode?: CaseMediaMode;
  priority?: boolean;
}) {
  if (!image) return null;
  return (
    <figure className={styles.figure}>
      <Image
        className={`${styles.image} ${styles[kind]}`}
        src={`/${mediaMode === 'preview' ? 'preview-media' : 'media'}/${image.mediaId}/original`}
        alt={image.decorative ? '' : image.alt}
        {...dimensions[kind]}
        sizes={sizes[kind]}
        unoptimized={mediaMode === 'preview'}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
      />
      {image.caption ? <figcaption className={styles.caption}>{image.caption}</figcaption> : null}
    </figure>
  );
}
