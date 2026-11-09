import { PortfolioLink } from '@/components/portfolio-link';
import type { CaseDetailDTO } from '../contracts/case-dto.schema';
import { CaseProse, caseEyebrowClass, caseTextLinkClass, type CaseLinkResolver } from './case-text';
import { caseCoverTransitionName } from './case-entry-motion';
import { CaseImage, type CaseMediaMode } from './case-image';
import { CaseContents } from './case-contents';
import { CaseSection } from './case-section';
export type CaseDetailProps = {
  caseDetail: CaseDetailDTO;
  projectsHref: string;
  labels: { back: string; contents: string; role: string; scope: string; newTab: string };
  resolveLink: CaseLinkResolver;
  mediaMode?: CaseMediaMode;
};
const factClass = 'grid content-start gap-3 rounded-lg bg-accent p-6';
const articleLayout = `
  grid min-w-0 gap-6 lg:gap-16
  [&>section+section]:mt-10 lg:[&>section+section]:mt-4
  max-lg:[&>[data-presentation=comparison]+section]:mt-0
  max-lg:[&>section+[data-presentation=comparison]]:mt-0
  lg:[&>:is([data-presentation=narrative],[data-presentation=process])+:is([data-presentation=narrative],[data-presentation=process])]:mt-0
`;
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
      <dl className="m-0 grid max-w-[48rem] gap-6 md:grid-cols-2">
        {caseDetail.role ? (
          <div className={factClass}>
            <dt className="text-sm font-semibold text-primary">{labels.role}</dt>
            <dd className="m-0 whitespace-pre-line text-muted-foreground">{caseDetail.role}</dd>
          </div>
        ) : null}
        {caseDetail.scope ? (
          <div className={factClass}>
            <dt className="text-sm font-semibold text-primary">{labels.scope}</dt>
            <dd className="m-0 whitespace-pre-line text-muted-foreground">{caseDetail.scope}</dd>
          </div>
        ) : null}
      </dl>
    ) : null;
  const { normal, emphasis } = caseDetail.titleParts;
  const published = mediaMode !== 'preview';
  return (
    <article className="min-w-0 wrap-anywhere">
      <header
        className="portfolio-container grid gap-8 py-6 lg:gap-12 lg:py-20"
        data-reading-key="case-opening"
      >
        <PortfolioLink href={projectsHref} className={`${caseTextLinkClass} -my-3`}>
          <span aria-hidden="true">← </span>
          {labels.back}
        </PortfolioLink>
        {caseDetail.eyebrow ? <p className={caseEyebrowClass}>{caseDetail.eyebrow}</p> : null}
        <h1 className="m-0 grid gap-8 text-5xl font-semibold whitespace-pre-line lg:gap-12 lg:text-7xl">
          {normal || emphasis ? (
            <>
              {normal}
              {normal && emphasis ? ' ' : null}
              {emphasis ? (
                <span className="block font-serif font-normal text-primary">{emphasis}</span>
              ) : null}
            </>
          ) : (
            caseDetail.title
          )}
        </h1>
        <CaseProse text={caseDetail.introduction ?? caseDetail.summary} className="text-lg" />
        <CaseImage
          image={caseDetail.cover}
          kind="cover"
          coverPresentation={caseDetail.coverPresentation}
          intrinsicSize={caseDetail.coverIntrinsicSize}
          mediaMode={mediaMode}
          transitionName={published ? caseCoverTransitionName(caseDetail) : undefined}
          priority
        />
        <CaseProse text={caseDetail.contextNote} className="text-sm" />
      </header>
      <div className="portfolio-container grid items-start gap-12 pt-12 pb-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 lg:py-20">
        <CaseContents entries={entries} label={labels.contents} />
        <div className={articleLayout.trim()}>
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
