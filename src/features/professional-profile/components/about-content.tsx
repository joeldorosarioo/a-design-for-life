import type { ProfileDTO } from '../contracts/profile-dto.schema';
import { cn } from 'cn';
import { ProfileProse, profileEyebrowClass, profileLinkClass } from './home-content';
import { ProfileImage } from './profile-image';

const editorialRowClass =
  'grid items-start gap-6 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:gap-x-[clamp(2rem,8.9vw,8rem)]';
const articleHeadingClass = 'font-serif text-3xl font-normal whitespace-pre-line lg:text-4xl';
const editorialBodyClass = 'min-w-0 lg:col-start-2';

export type AboutContentProps = {
  profile: ProfileDTO;
  projectsHref: string;
  mediaMode?: 'published' | 'preview';
};

export function AboutContent({
  profile,
  projectsHref,
  mediaMode = 'published',
}: AboutContentProps) {
  const { about } = profile;
  return (
    <article className="portfolio-container grid gap-16 pt-12 pb-24 wrap-anywhere lg:gap-24 lg:pt-20">
      <header className="grid gap-6 border-b border-border pb-6" data-reading-key="about-opening">
        {about.eyebrow ? <p className={profileEyebrowClass}>{about.eyebrow}</p> : null}
        {about.title ? (
          <h1 className="max-w-[60rem] font-serif text-4xl font-normal whitespace-pre-line lg:text-6xl">
            {about.title}
          </h1>
        ) : null}
        <ProfileProse text={about.description} className="max-w-[48rem] text-xl" />
      </header>
      <section
        className="grid items-start gap-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-center lg:gap-x-[clamp(2rem,8.9vw,8rem)]"
        data-reading-key="about-introduction"
      >
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {about.introductionHeading ? (
            <h2 className="sr-only">{about.introductionHeading}</h2>
          ) : null}
          <ProfileProse
            text={about.introduction}
            className="text-lg [&>p:first-child]:text-foreground lg:[&>p:first-child]:text-xl"
          />
        </div>
        <div className="lg:col-start-1 lg:row-start-1">
          <ProfileImage image={about.portrait} kind="about-portrait" mediaMode={mediaMode} />
        </div>
      </section>
      <section className={editorialRowClass} data-reading-key="about-journey">
        <div>
          {about.journeyEyebrow ? (
            <p className={profileEyebrowClass}>{about.journeyEyebrow}</p>
          ) : null}
          {about.journeyHeading ? (
            <h2 className={cn(articleHeadingClass, '[p+&]:mt-4')}>{about.journeyHeading}</h2>
          ) : null}
        </div>
        <ProfileProse text={about.journey} className={cn(editorialBodyClass, 'text-lg')} />
      </section>
      <div data-reading-key="about-desk">
        <ProfileImage image={about.deskPhotograph} kind="desk" mediaMode={mediaMode} />
      </div>
      <div
        className="text-[color:var(--action-default)] before:mb-6 before:block before:h-[2px] before:w-9 before:bg-[var(--action-default)] before:content-[''] lg:w-full lg:max-w-[56rem] lg:justify-self-center"
        data-reading-key="about-emphasis"
      >
        <ProfileProse
          text={about.editorialEmphasis}
          className="font-serif text-3xl text-current lg:text-4xl"
        />
      </div>
      <section className={editorialRowClass} data-reading-key="about-approach">
        <ProfileImage
          image={about.architecturePhotograph}
          kind="architecture"
          mediaMode={mediaMode}
        />
        <div className={cn(editorialBodyClass, '[figure+&]:mt-2 lg:[figure+&]:mt-0')}>
          {about.approachEyebrow ? (
            <p className={profileEyebrowClass}>{about.approachEyebrow}</p>
          ) : null}
          {about.approachHeading ? (
            <h2
              className={cn(
                articleHeadingClass,
                '[p+&]:mt-6',
                about.architecturePhotograph && 'mb-6',
              )}
            >
              {about.approachHeading}
            </h2>
          ) : null}
          <ProfileProse text={about.approach} className="text-lg" />
        </div>
      </section>
      <section className={editorialRowClass} data-reading-key="about-in-motion">
        <div>
          {about.inMotionEyebrow ? (
            <p className={profileEyebrowClass}>{about.inMotionEyebrow}</p>
          ) : null}
          {about.inMotionHeading ? (
            <h2 className={cn(articleHeadingClass, '[p+&]:mt-4')}>{about.inMotionHeading}</h2>
          ) : null}
        </div>
        <ProfileProse text={about.inMotion} className={cn(editorialBodyClass, 'text-lg')} />
      </section>
      <section className={editorialRowClass} data-reading-key="about-closing">
        <div className="border-t border-border lg:pt-6">
          {about.closingHeading ? <h2 className="sr-only">{about.closingHeading}</h2> : null}
        </div>
        <div className={editorialBodyClass}>
          <ProfileProse text={about.closing} className="text-lg" />
          {about.projectsLabel ? (
            <a
              className={cn(profileLinkClass, 'mt-6 inline-block py-3 text-base')}
              href={projectsHref}
            >
              {about.projectsLabel}
              <span aria-hidden="true"> →</span>
            </a>
          ) : null}
        </div>
      </section>
    </article>
  );
}
