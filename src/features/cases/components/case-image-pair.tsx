import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseImage, type CaseMediaMode } from './case-image';
import styles from '../stylesheets/cases.module.css';
type ImagePair = Extract<
  CaseDetailDTO['sections'][number]['blocks'][number],
  { type: 'image-pair' }
>;
export function CaseImagePair({
  block,
  mediaMode,
}: {
  block: ImagePair;
  mediaMode?: CaseMediaMode;
}) {
  return (
    <div className={styles.imagePair} data-reading-key={block.readingKey}>
      <div>
        {block.firstLabel ? <p className={styles.imageLabel}>{block.firstLabel}</p> : null}
        <CaseImage image={block.first} kind="pair" mediaMode={mediaMode} />
      </div>
      <div>
        {block.secondLabel ? <p className={styles.imageLabel}>{block.secondLabel}</p> : null}
        <CaseImage image={block.second} kind="pair" mediaMode={mediaMode} />
      </div>
    </div>
  );
}
