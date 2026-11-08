import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseImage, type CaseMediaMode } from './case-image';
type ImagePair = Extract<
  CaseDetailDTO['sections'][number]['blocks'][number],
  { type: 'image-pair' }
>;
const imageLabelClass = 'm-0 mb-4 text-sm font-semibold text-primary';
export function CaseImagePair({
  block,
  mediaMode,
}: {
  block: ImagePair;
  mediaMode?: CaseMediaMode;
}) {
  return (
    <div className="grid min-w-0 gap-8 md:grid-cols-2" data-reading-key={block.readingKey}>
      <div className="min-w-0">
        {block.firstLabel ? <p className={imageLabelClass}>{block.firstLabel}</p> : null}
        <CaseImage image={block.first} kind="pair" mediaMode={mediaMode} />
      </div>
      <div className="min-w-0">
        {block.secondLabel ? <p className={imageLabelClass}>{block.secondLabel}</p> : null}
        <CaseImage image={block.second} kind="pair" mediaMode={mediaMode} />
      </div>
    </div>
  );
}
