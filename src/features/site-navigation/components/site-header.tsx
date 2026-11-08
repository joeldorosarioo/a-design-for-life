import type { ReactNode } from 'react';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
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
        <NavigationMenu aria-label={navigationLabel} className={styles.desktopNavigation}>
          <NavigationMenuList className={styles.navigationList}>
            {navigation.items.map((item) => (
              <NavigationMenuItem key={item.purpose}>
                <NavigationMenuLink
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
                    <span className="sr-only"> ({navigation.controls.newTabLabel})</span>
                  )}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
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
