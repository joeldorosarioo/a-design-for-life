import type { ReactNode } from 'react';
import type { Locale } from '@/helpers/i18n/locale.schema';
import type { PortfolioPresentation } from '@/config/portfolio-presentation';
import type { NavigationPresentation } from '@/features/site-navigation';
import type { CaseLinkResolver } from '@/features/cases/ui';
import type { CaseDetailDTO } from '@/features/cases';
import { CaseDetail, CaseGrid, CaseList, CaseState } from '@/features/cases/ui';
import { resolveContextualLink } from '@/features/cases/server';
import { HomeContent, AboutContent } from '@/features/professional-profile/ui';
import { SiteHeader, SiteFooter } from '@/features/site-navigation/ui';
import { resolveNavigation } from '@/features/site-navigation/server';
import styles from '../stylesheets/public-page.module.css';
export type PublicPageViewProps = {
  locale: Locale;
  kind: 'home' | 'cases' | 'about' | 'case';
  portfolio: PortfolioPresentation | null;
  detail?: CaseDetailDTO;
  status?: 200 | 404 | 410 | 503;
  languageControl?: ReactNode;
  mediaMode?: 'published' | 'preview';
  /** Supplied only by the server composition after selecting authorized presentation data. */
  targets?: { home: string; cases: string; about: string };
  navigationOverride?: NavigationPresentation;
  resolveLink?: CaseLinkResolver;
};
export function PublicPageView({
  locale,
  kind,
  portfolio,
  detail,
  status = 200,
  languageControl,
  mediaMode = 'published',
  targets,
  navigationOverride,
  resolveLink,
}: PublicPageViewProps) {
  const english = locale === 'en';
  const home = targets?.home ?? `/${locale}`;
  const projects = targets?.cases ?? `/${locale}/cases`;
  const controls = portfolio?.navigation.controls;
  const messages = portfolio?.navigation.messages;
  let navigation: NavigationPresentation | null = navigationOverride ?? null;
  if (portfolio && !navigationOverride) {
    try {
      navigation = resolveNavigation({
        locale,
        navigation: portfolio.navigation,
        profile: portfolio.profile,
      });
    } catch {
      // A confirmed case remains readable before structural content is available.
      // Other successful page kinds are validated with the full shell in Proxy.
    }
  }
  const emptyState = {
    title:
      messages?.emptyCasesTitle ??
      (english ? 'No projects published yet' : 'Nenhum projeto publicado ainda'),
    description: messages?.emptyCasesDescription ?? '',
  };
  let content;
  if (status !== 200) {
    const title =
      status === 404
        ? (messages?.notFoundTitle ?? (english ? 'Page not found' : 'Página não encontrada'))
        : status === 410
          ? (messages?.caseUnavailableTitle ?? (english ? 'Case unavailable' : 'Case indisponível'))
          : (messages?.temporaryFailureTitle ??
            (english ? 'Temporarily unavailable' : 'Temporariamente indisponível'));
    const description =
      status === 404
        ? messages?.notFoundDescription
        : status === 410
          ? messages?.caseUnavailableDescription
          : messages?.temporaryFailureDescription;
    content = (
      <CaseState
        title={title}
        description={description ?? ''}
        links={[
          { href: projects, label: controls?.casesLabel ?? (english ? 'Projects' : 'Projetos') },
          {
            href: '#contact',
            label: navigation?.items[3].label ?? (english ? 'Contact' : 'Contato'),
          },
        ]}
      />
    );
  } else if (kind === 'home' && portfolio) {
    content = (
      <HomeContent
        profile={portfolio.profile}
        projectsHref={projects}
        aboutHref={targets?.about ?? (english ? '/en/about' : '/pt/sobre')}
        mediaMode={mediaMode}
        featuredProjects={
          <CaseGrid
            cases={portfolio.featured}
            caseLinkLabel={controls?.caseLinkLabel ?? null}
            emptyState={emptyState}
            headingLevel={3}
            mediaMode={mediaMode}
          />
        }
      />
    );
  } else if (kind === 'about' && portfolio) {
    content = (
      <AboutContent profile={portfolio.profile} projectsHref={projects} mediaMode={mediaMode} />
    );
  } else if (kind === 'cases' && portfolio) {
    content = (
      <CaseList
        opening={portfolio.profile.listing}
        homeHref={home}
        homeLabel={controls?.homeLabel ?? 'Home'}
        cases={portfolio.cases}
        caseLinkLabel={controls?.caseLinkLabel ?? null}
        countLabel={controls?.casesLabel ?? 'Cases'}
        emptyState={emptyState}
        mediaMode={mediaMode}
      />
    );
  } else if (kind === 'case' && detail) {
    content = (
      <CaseDetail
        caseDetail={detail}
        projectsHref={projects}
        labels={{
          back: controls?.casesLabel ?? (english ? 'Projects' : 'Projetos'),
          contents: controls?.contentsLabel ?? (english ? 'Contents' : 'Sumário'),
          role: controls?.roleLabel ?? (english ? 'Role' : 'Papel'),
          scope: controls?.scopeLabel ?? (english ? 'Scope' : 'Escopo'),
          newTab: controls?.newTabLabel ?? (english ? 'opens in a new tab' : 'abre em nova aba'),
        }}
        resolveLink={
          resolveLink ??
          ((link) =>
            portfolio
              ? resolveContextualLink(link, {
                  locale,
                  routes: portfolio.routes,
                  profile: portfolio.profile,
                })
              : null)
        }
        mediaMode={mediaMode}
      />
    );
  } else {
    throw new Error('Verified public page content is unavailable.');
  }
  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        {english ? 'Skip to content' : 'Pular para o conteúdo'}
      </a>
      {navigation ? (
        <SiteHeader navigation={navigation} languageControl={languageControl} />
      ) : (
        <header className={`portfolio-container ${styles.fallbackHeader}`}>
          <a href={home}>{controls?.homeLabel ?? 'Home'}</a>
          {languageControl}
        </header>
      )}
      <main id="main-content" tabIndex={-1}>
        {content}
      </main>
      {navigation ? (
        <SiteFooter navigation={navigation} />
      ) : (
        <footer
          id="contact"
          tabIndex={-1}
          className={`portfolio-container ${styles.fallbackFooter}`}
        >
          <a href={projects}>{english ? 'Projects' : 'Projetos'}</a>
          <p>
            {english
              ? 'Contact information is temporarily unavailable.'
              : 'As informações de contato estão temporariamente indisponíveis.'}
          </p>
        </footer>
      )}
    </>
  );
}
