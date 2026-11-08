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

export function SiteHeader({
  navigation,
  languageControl,
}: {
  navigation: NavigationPresentation;
  languageControl?: ReactNode;
}) {
  const navigationLabel = navigation.locale === 'pt' ? 'Navegação principal' : 'Main navigation';
  return (
    <header className="sticky [inset-block-start:0] z-30 bg-background" data-portfolio-header>
      <HeaderMetrics />
      <div className="portfolio-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-4 py-6 lg:flex">
        <a
          className="flex min-h-12 items-center text-xl font-semibold text-foreground no-underline wrap-anywhere hover:underline hover:underline-offset-[0.25em] lg:me-auto lg:min-w-0"
          href={navigation.brand.href}
        >
          {navigation.brand.label}
        </a>
        <NavigationMenu aria-label={navigationLabel} className="hidden lg:block lg:min-w-0">
          <NavigationMenuList className="m-0 flex list-none items-center gap-8 p-0 [&>li]:min-w-0">
            {navigation.items.map((item) => (
              <NavigationMenuItem key={item.purpose}>
                <NavigationMenuLink
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground no-underline wrap-anywhere hover:underline hover:underline-offset-[0.25em]"
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
        {languageControl && (
          <div className="col-start-2 row-start-1 min-h-12 min-w-12 lg:shrink-0">
            {languageControl}
          </div>
        )}
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
