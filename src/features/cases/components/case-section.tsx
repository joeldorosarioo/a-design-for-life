import type { ReactNode } from 'react';
import Image from 'next/image';
import { cva } from 'class-variance-authority';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseText, CaseProse, caseEyebrowClass, type CaseLinkResolver } from './case-text';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseImagePair } from './case-image-pair';
export type CaseSectionProps = {
  section: CaseDetailDTO['sections'][number];
  resolveLink: CaseLinkResolver;
  newTabLabel: string;
  mediaMode?: CaseMediaMode;
  facts?: ReactNode;
  dividerBefore?: boolean;
};
const sectionClass = cva(
  'grid min-w-0 scroll-mt-[calc(var(--portfolio-header-height,6rem)+var(--space-8))]',
  {
    variants: {
      presentation: {
        narrative: 'gap-6',
        process: 'max-w-[48rem] gap-6',
        comparison: '-mx-[var(--layout-page-padding)] gap-8 bg-accent p-6 lg:mx-0 lg:gap-12 lg:p-8',
        learnings: 'gap-8 lg:gap-12',
      },
    },
  },
);

const sectionBlocksClass = cva('grid min-w-0', {
  variants: {
    presentation: {
      narrative: 'gap-6',
      process: 'gap-6',
      comparison: 'items-start gap-8 md:grid-cols-2',
      learnings: 'gap-6 lg:grid-cols-3 lg:gap-10',
    },
  },
});

const textBlockClass = cva('grid min-w-0 content-start', {
  variants: {
    presentation: {
      narrative: 'max-w-[48rem] gap-4',
      process: 'gap-4',
      comparison: 'gap-6 rounded-xl p-8 first:bg-card',
      learnings: 'gap-4 p-6',
    },
  },
});

const dividerClass = '-mt-px block h-px max-w-full object-cover';

export function CaseSection({
  section,
  resolveLink,
  newTabLabel,
  mediaMode,
  facts,
  dividerBefore = section.presentation === 'process',
}: CaseSectionProps) {
  const { presentation } = section;
  const narrative = presentation === 'narrative';
  const comparison = presentation === 'comparison';
  const learnings = presentation === 'learnings';
  return (
    <section
      id={`section-${section.readingKey}`}
      data-reading-key={section.readingKey}
      data-presentation={presentation}
      className={sectionClass({ presentation })}
      aria-labelledby={section.heading ? `heading-${section.readingKey}` : undefined}
    >
      {dividerBefore ? (
        <Image
          unoptimized
          src="/figma/case-divider.svg"
          alt=""
          width={768}
          height={1}
          className={dividerClass}
        />
      ) : null}
      <div className={narrative ? 'grid min-w-0 max-w-[48rem] gap-4' : 'grid min-w-0 gap-4'}>
        {section.eyebrow ? <p className={caseEyebrowClass}>{section.eyebrow}</p> : null}
        {section.heading ? (
          <h2
            id={`heading-${section.readingKey}`}
            className={`m-0 text-4xl font-semibold whitespace-pre-line ${comparison || learnings ? 'lg:text-5xl' : ''}`}
          >
            {section.heading}
          </h2>
        ) : null}
        <CaseProse text={section.description} className="text-lg" />
      </div>
      {facts}
      {section.blocks.length ? (
        <div className={sectionBlocksClass({ presentation })}>
          {section.blocks.map((block) => {
            if (block.type === 'image-pair')
              return <CaseImagePair key={block.readingKey} block={block} mediaMode={mediaMode} />;
            if (block.type === 'image')
              return (
                <div key={block.readingKey} data-reading-key={block.readingKey}>
                  <CaseImage image={block.image} mediaMode={mediaMode} />
                </div>
              );
            return (
              <div
                key={block.readingKey}
                data-reading-key={block.readingKey}
                className={textBlockClass({ presentation })}
              >
                {learnings ? (
                  <Image
                    unoptimized
                    src="/figma/learning-divider.svg"
                    alt=""
                    width={261.333}
                    height={1}
                    className={`${dividerClass} w-full`}
                  />
                ) : null}
                {block.eyebrow ? (
                  <p
                    className={
                      learnings
                        ? 'm-0 text-sm font-semibold whitespace-pre-line text-primary'
                        : caseEyebrowClass
                    }
                  >
                    {block.eyebrow}
                  </p>
                ) : null}
                {block.heading ? (
                  <h3
                    className={`m-0 font-semibold whitespace-pre-line ${comparison ? 'text-3xl' : 'text-2xl'}`}
                  >
                    {block.heading}
                  </h3>
                ) : null}
                <CaseText
                  content={block.content}
                  resolveLink={resolveLink}
                  newTabLabel={newTabLabel}
                  className={
                    narrative
                      ? 'text-foreground [&>:not(:first-child)]:mt-4'
                      : comparison
                        ? 'text-foreground'
                        : undefined
                  }
                />
                <CaseProse
                  text={block.note}
                  className={
                    narrative
                      ? 'text-sm text-primary [&>:not(:first-child)]:mt-4'
                      : comparison
                        ? 'text-sm text-foreground'
                        : 'text-sm text-primary'
                  }
                />
              </div>
            );
          })}
        </div>
      ) : null}
      <CaseProse text={section.note} className="text-sm" />
    </section>
  );
}
