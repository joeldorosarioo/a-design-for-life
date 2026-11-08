import type { ReactNode } from 'react';
import type { ProfileDTO } from '../contracts/profile-dto.schema';
import { buttonVariants } from '@/components/ui/button';
import { ProfileImage } from './profile-image';
import styles from '../stylesheets/profile-content.module.css';

export type HomeContentProps = {
  profile: ProfileDTO;
  /** Destinations are supplied by the validated navigation at the composition root. */
  projectsHref: string;
  aboutHref: string;
  /** Cases owns this slot's data, empty state and cards. */
  featuredProjects: ReactNode;
  mediaMode?: 'published' | 'preview';
};

/** Profile copy is plain text: blank lines separate paragraphs; single newlines remain line breaks. */
export function ProfileProse({
  text,
  className = '',
}: {
  text: string | null;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div className={`${styles.prose} ${className}`}>
      {text
        .split(/\r?\n[\t ]*\r?\n+/)
        .filter((paragraph) => paragraph.trim())
        .map((paragraph, index) => (
          <p key={`${index}-${paragraph}`}>{paragraph}</p>
        ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  editorial = false,
}: {
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  editorial?: boolean;
}) {
  return (
    <div className={styles.sectionHeading}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      {title ? (
        <h2 className={editorial ? styles.editorialTitle : styles.sectionTitle}>{title}</h2>
      ) : null}
      <ProfileProse text={description} />
    </div>
  );
}

export function HomeContent({
  profile,
  projectsHref,
  aboutHref,
  featuredProjects,
  mediaMode = 'published',
}: HomeContentProps) {
  const { home, homeProjects, homeAbout, approach } = profile;
  const trajectory = homeAbout.trajectory.filter(
    (item) => item.period || item.title || item.description,
  );
  const methods = approach.methods.filter(
    (item) => item.title || item.description || item.keywords,
  );
  return (
    <div className={styles.home}>
      <section className={`portfolio-container ${styles.hero}`} data-reading-key="home-hero">
        <div className={styles.heroCopy}>
          {home.eyebrow ? <p className={styles.eyebrow}>{home.eyebrow}</p> : null}
          {home.title || home.titleEmphasis ? (
            <h1 className={styles.heroTitle}>
              {home.title}
              {home.title && home.titleEmphasis ? ' ' : null}
              {home.titleEmphasis ? (
                <span className={styles.heroEmphasis}>{home.titleEmphasis}</span>
              ) : null}
            </h1>
          ) : null}
          <ProfileProse text={home.description} className={styles.heroDescription} />
          {home.projectsLabel ? (
            <a href={projectsHref} className={buttonVariants({ variant: 'primary' })}>
              {home.projectsLabel}
              <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </div>
        <ProfileImage image={home.portrait} kind="portrait" mediaMode={mediaMode} />
      </section>

      <section
        className={`portfolio-container ${styles.projects}`}
        data-reading-key="home-projects"
      >
        <SectionHeading {...homeProjects} />
        {featuredProjects}
      </section>

      <section className={styles.homeAbout} data-reading-key="home-about">
        <div className={`portfolio-container ${styles.homeAboutInner}`}>
          <div className={styles.homeAboutCopy}>
            <SectionHeading {...homeAbout} editorial />
            {homeAbout.aboutLabel ? (
              <a href={aboutHref} className={styles.textLink}>
                {homeAbout.aboutLabel}
                <span aria-hidden="true"> →</span>
              </a>
            ) : null}
          </div>
          {trajectory.length > 0 ? (
            <ol className={styles.trajectory}>
              {trajectory.map((item) => (
                <li
                  key={item.readingKey ?? item.period ?? item.title ?? item.description}
                  data-reading-key={item.readingKey ?? undefined}
                >
                  {item.period ? <p className={styles.eyebrow}>{item.period}</p> : null}
                  {item.title ? <h3 className={styles.itemTitle}>{item.title}</h3> : null}
                  <ProfileProse text={item.description} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>

      <section
        className={`portfolio-container ${styles.approach}`}
        data-reading-key="home-approach"
      >
        <SectionHeading {...approach} />
        {methods.length > 0 ? (
          <ol className={styles.methods}>
            {methods.map((method, index) => (
              <li
                key={method.readingKey ?? method.title ?? method.description ?? method.keywords}
                className={styles.method}
                data-reading-key={method.readingKey ?? undefined}
              >
                <span className={styles.ordinal} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {method.title ? <h3 className={styles.itemTitle}>{method.title}</h3> : null}
                <ProfileProse text={method.description} />
                {method.keywords ? <p className={styles.keywords}>{method.keywords}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
