import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseProse, type CaseLinkResolver } from './case-text';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseContents } from './case-contents';
import { CaseSection } from './case-section';
import styles from '../stylesheets/cases.module.css';
export type CaseDetailProps = {
  caseDetail: CaseDetailDTO;
  projectsHref: string;
  labels: { back: string; contents: string; role: string; scope: string; newTab: string };
  resolveLink: CaseLinkResolver;
  mediaMode?: CaseMediaMode;
};
export function CaseDetail({
  caseDetail,
  projectsHref,
  labels,
  resolveLink,
  mediaMode,
}: CaseDetailProps) {
  const sections = caseDetail.sections.filter(
    (section) =>
      section.eyebrow ||
      section.heading ||
      section.description ||
      section.note ||
      section.blocks.length,
  );
  const entries = sections.flatMap((section) => {
    const label = section.heading?.trim() || section.eyebrow?.trim();
    return label
      ? [{ readingKey: section.readingKey, label, anchor: `section-${section.readingKey}` }]
      : [];
  });
  const facts =
    caseDetail.role || caseDetail.scope ? (
      <dl className={styles.facts}>
        {caseDetail.role ? (
          <div>
            <dt>{labels.role}</dt>
            <dd>{caseDetail.role}</dd>
          </div>
        ) : null}
        {caseDetail.scope ? (
          <div>
            <dt>{labels.scope}</dt>
            <dd>{caseDetail.scope}</dd>
          </div>
        ) : null}
      </dl>
    ) : null;
  const { normal, emphasis } = caseDetail.titleParts;
  return (
    <article className={styles.detail}>
      <header
        className={`portfolio-container ${styles.detailOpening}`}
        data-reading-key="case-opening"
      >
        <a href={projectsHref} className={styles.textLink}>
          <span aria-hidden="true">← </span>
          {labels.back}
        </a>
        {caseDetail.eyebrow ? <p className={styles.eyebrow}>{caseDetail.eyebrow}</p> : null}
        <h1 className={styles.detailTitle}>
          {normal || emphasis ? (
            <>
              {normal}
              {normal && emphasis ? ' ' : null}
              {emphasis ? <span className={styles.titleEmphasis}>{emphasis}</span> : null}
            </>
          ) : (
            caseDetail.title
          )}
        </h1>
        <CaseProse
          text={caseDetail.introduction ?? caseDetail.summary}
          className={styles.openingIntroduction}
        />
        <CaseImage
          image={caseDetail.cover}
          kind="cover"
          coverPresentation={caseDetail.coverPresentation}
          mediaMode={mediaMode}
          priority
        />
        <CaseProse text={caseDetail.contextNote} className={styles.note} />
      </header>
      <div className={`portfolio-container ${styles.readingLayout}`}>
        <CaseContents entries={entries} label={labels.contents} />
        <div className={styles.articleBody}>
          {sections.length
            ? sections.map((section, index) => (
                <CaseSection
                  key={section.readingKey}
                  section={section}
                  resolveLink={resolveLink}
                  newTabLabel={labels.newTab}
                  mediaMode={mediaMode}
                  facts={index === 0 ? facts : null}
                  dividerBefore={
                    section.presentation === 'process' ||
                    (section.presentation === 'narrative' && index > 0)
                  }
                />
              ))
            : facts}
        </div>
      </div>
    </article>
  );
}
