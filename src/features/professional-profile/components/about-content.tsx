import type { ProfileDTO } from '../contracts/profile-dto.schema';
import { ProfileProse } from './home-content';
import { ProfileImage } from './profile-image';
import styles from '../stylesheets/profile-content.module.css';

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
    <article className={`portfolio-container ${styles.about}`}>
      <header className={styles.aboutOpening} data-reading-key="about-opening">
        {about.eyebrow ? <p className={styles.eyebrow}>{about.eyebrow}</p> : null}
        {about.title ? <h1 className={styles.aboutTitle}>{about.title}</h1> : null}
        <ProfileProse text={about.description} className={styles.aboutDescription} />
      </header>
      <section className={styles.introduction} data-reading-key="about-introduction">
        <div className={styles.introductionCopy}>
          {about.introductionHeading ? (
            <h2 className="sr-only">{about.introductionHeading}</h2>
          ) : null}
          <ProfileProse text={about.introduction} className={styles.introductionProse} />
        </div>
        <div className={styles.introductionPortrait}>
          <ProfileImage image={about.portrait} kind="about-portrait" mediaMode={mediaMode} />
        </div>
      </section>
      <section className={styles.editorialRow} data-reading-key="about-journey">
        <div>
          {about.journeyEyebrow ? <p className={styles.eyebrow}>{about.journeyEyebrow}</p> : null}
          {about.journeyHeading ? (
            <h2 className={styles.articleHeading}>{about.journeyHeading}</h2>
          ) : null}
        </div>
        <ProfileProse text={about.journey} className={styles.editorialBody} />
      </section>
      <div data-reading-key="about-desk">
        <ProfileImage image={about.deskPhotograph} kind="desk" mediaMode={mediaMode} />
      </div>
      <div className={styles.editorialEmphasis} data-reading-key="about-emphasis">
        <ProfileProse text={about.editorialEmphasis} />
      </div>
      <section className={styles.editorialRow} data-reading-key="about-approach">
        <ProfileImage
          image={about.architecturePhotograph}
          kind="architecture"
          mediaMode={mediaMode}
        />
        <div className={styles.editorialBody}>
          {about.approachEyebrow ? <p className={styles.eyebrow}>{about.approachEyebrow}</p> : null}
          {about.approachHeading ? (
            <h2 className={styles.articleHeading}>{about.approachHeading}</h2>
          ) : null}
          <ProfileProse text={about.approach} />
        </div>
      </section>
      <section className={styles.editorialRow} data-reading-key="about-in-motion">
        <div>
          {about.inMotionEyebrow ? <p className={styles.eyebrow}>{about.inMotionEyebrow}</p> : null}
          {about.inMotionHeading ? (
            <h2 className={styles.articleHeading}>{about.inMotionHeading}</h2>
          ) : null}
        </div>
        <ProfileProse text={about.inMotion} className={styles.editorialBody} />
      </section>
      <section
        className={`${styles.editorialRow} ${styles.closing}`}
        data-reading-key="about-closing"
      >
        <div className={styles.closingHeading}>
          {about.closingHeading ? <h2 className="sr-only">{about.closingHeading}</h2> : null}
        </div>
        <div className={styles.editorialBody}>
          <ProfileProse text={about.closing} />
          {about.projectsLabel ? (
            <a className={styles.textLink} href={projectsHref}>
              {about.projectsLabel}
              <span aria-hidden="true"> →</span>
            </a>
          ) : null}
        </div>
      </section>
    </article>
  );
}
