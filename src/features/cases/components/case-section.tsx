import type { ReactNode } from 'react';
import Image from 'next/image';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseText, CaseProse, type CaseLinkResolver } from './case-text';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseImagePair } from './case-image-pair';
import styles from '../stylesheets/cases.module.css';
export type CaseSectionProps = {
  section: CaseDetailDTO['sections'][number];
  resolveLink: CaseLinkResolver;
  newTabLabel: string;
  mediaMode?: CaseMediaMode;
  facts?: ReactNode;
  dividerBefore?: boolean;
};
export function CaseSection({
  section,
  resolveLink,
  newTabLabel,
  mediaMode,
  facts,
  dividerBefore = section.presentation === 'process',
}: CaseSectionProps) {
  return (
    <section
      id={`section-${section.readingKey}`}
      data-reading-key={section.readingKey}
      className={`${styles.caseSection} ${styles[section.presentation]}`}
      aria-labelledby={section.heading ? `heading-${section.readingKey}` : undefined}
    >
      {dividerBefore ? (
        <Image
          unoptimized
          src="/figma/case-divider.svg"
          alt=""
          width={768}
          height={1}
          className={styles.divider}
        />
      ) : null}
      <div className={styles.sectionHeading}>
        {section.eyebrow ? <p className={styles.eyebrow}>{section.eyebrow}</p> : null}
        {section.heading ? (
          <h2 id={`heading-${section.readingKey}`} className={styles.sectionTitle}>
            {section.heading}
          </h2>
        ) : null}
        <CaseProse text={section.description} />
      </div>
      {facts}
      {section.blocks.length ? (
        <div className={`${styles.sectionBlocks} ${styles[`${section.presentation}Blocks`]}`}>
          {section.blocks.map((block) => {
            if (block.type === 'image-pair')
              return <CaseImagePair key={block.readingKey} block={block} mediaMode={mediaMode} />;
            if (block.type === 'image')
              return (
                <div
                  key={block.readingKey}
                  data-reading-key={block.readingKey}
                  className={styles.imageBlock}
                >
                  <CaseImage image={block.image} mediaMode={mediaMode} />
                </div>
              );
            return (
              <div
                key={block.readingKey}
                data-reading-key={block.readingKey}
                className={styles.textBlock}
              >
                {section.presentation === 'learnings' ? (
                  <Image
                    unoptimized
                    src="/figma/learning-divider.svg"
                    alt=""
                    width={261.333}
                    height={1}
                    className={styles.divider}
                  />
                ) : null}
                {block.eyebrow ? <p className={styles.eyebrow}>{block.eyebrow}</p> : null}
                {block.heading ? <h3 className={styles.blockTitle}>{block.heading}</h3> : null}
                <CaseText
                  content={block.content}
                  resolveLink={resolveLink}
                  newTabLabel={newTabLabel}
                />
                <CaseProse text={block.note} className={styles.note} />
              </div>
            );
          })}
        </div>
      ) : null}
      <CaseProse text={section.note} className={styles.note} />
    </section>
  );
}
