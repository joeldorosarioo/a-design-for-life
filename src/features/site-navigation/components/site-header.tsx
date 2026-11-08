import type { ReactNode } from 'react';
import type { NavigationPresentation } from '../contracts/navigation-presentation';
import { MobileMenu } from './mobile-menu';
import { HeaderMetrics } from './header-metrics';
import styles from '../stylesheets/navigation.module.css';

export function SiteHeader({
  navigation,
  languageControl,
}: {
  navigation: NavigationPresentation;
  languageControl?: ReactNode;
}) {
  const navigationLabel = navigation.locale === 'pt' ? 'Navegação principal' : 'Main navigation';
  return (
    <header className={styles.header} data-portfolio-header>
      <HeaderMetrics />
      <div className={`portfolio-container ${styles.headerInner}`}>
        <a className={styles.brand} href={navigation.brand.href}>
          {navigation.brand.label}
        </a>
        <nav aria-label={navigationLabel} className={styles.desktopNavigation}>
          <ul className={styles.navigationList}>
            {navigation.items.map((item) => (
              <li key={item.purpose}>
                <a
                  className={styles.navigationLink}
                  href={item.destination.href}
                  data-analytics-purpose={item.purpose === 'resume' ? 'resume' : undefined}
                  aria-label={
                    item.destination.kind === 'resume'
                      ? `${item.label} (${navigation.controls.newTabLabel})`
                      : undefined
                  }
                  {...(item.destination.kind === 'resume'
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {item.label}
                  {item.destination.kind === 'resume' && (
                    <span className={styles.visuallyHidden}>
                      {' '}
                      ({navigation.controls.newTabLabel})
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {languageControl && <div className={styles.languageControl}>{languageControl}</div>}
        <MobileMenu
          items={navigation.items}
          controls={{
            openMenuLabel: navigation.controls.openMenuLabel,
            closeMenuLabel: navigation.controls.closeMenuLabel,
            newTabLabel: navigation.controls.newTabLabel,
          }}
          navigationLabel={navigationLabel}
        />
      </div>
    </header>
  );
}
