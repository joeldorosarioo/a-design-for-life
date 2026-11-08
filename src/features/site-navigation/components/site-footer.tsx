import type { NavigationPresentation } from '../contracts/navigation-presentation';
import { Button } from '@/components/ui/button';

export function SiteFooter({ navigation }: { navigation: NavigationPresentation }) {
  const { footer, contacts, brand, controls } = navigation;
  return (
    <footer className="bg-[var(--bg-inverse)] text-[color:var(--text-inverse)] [--focus-ring:var(--color-cherry-cola-100)]">
      <div className="portfolio-container flex flex-col items-start gap-8 py-12 lg:pt-20">
        {footer.eyebrow && (
          <p className="m-0 text-xs font-semibold text-cherry-cola-100 wrap-anywhere">
            {footer.eyebrow}
          </p>
        )}
        {footer.title && (
          <h2 className="m-0 font-serif text-4xl font-normal whitespace-pre-line wrap-anywhere lg:text-6xl">
            {footer.title}
          </h2>
        )}
        {footer.description && (
          <p className="m-0 text-lg text-cherry-cola-100 wrap-anywhere">{footer.description}</p>
        )}
        <ul
          id="contact"
          data-reading-key="site-contact"
          tabIndex={-1}
          aria-label={navigation.items[3].label}
          className="m-0 flex w-full max-w-full list-none flex-wrap gap-4 p-0 [scroll-margin-block-start:calc(var(--portfolio-header-height,6rem)+var(--space-6))] [&>li]:max-w-full"
        >
          <li className="min-w-[min(13rem,100%)]">
            <Button asChild className="w-full max-w-full justify-start">
              <a href={`mailto:${contacts.email}`} data-analytics-purpose="email">
                {footer.emailLabel}
              </a>
            </Button>
          </li>
          <li>
            <Button asChild>
              <a href={contacts.linkedin} data-analytics-purpose="linkedin">
                {footer.linkedinLabel}
              </a>
            </Button>
          </li>
          <li>
            <Button asChild>
              <a
                href={navigation.items[2].destination.href}
                data-analytics-purpose="resume"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${footer.resumeLabel} (${controls.newTabLabel})`}
              >
                {footer.resumeLabel}
                <span className="sr-only"> ({controls.newTabLabel})</span>
              </a>
            </Button>
          </li>
        </ul>
        {/* Exact approved Figma SVG; its intrinsic dimensions are preserved. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static one-pixel Figma divider */}
        <img
          className="block h-px w-full"
          src="/figma/footer-divider.svg"
          width={1280}
          height={1}
          alt=""
        />
        <div className="flex flex-wrap justify-between gap-4 self-stretch">
          <a
            className="text-sm font-semibold text-[color:var(--text-inverse)] no-underline wrap-anywhere hover:underline hover:underline-offset-[0.25em]"
            href={brand.href}
          >
            {brand.label}
          </a>
          {footer.copyright && (
            <p className="m-0 w-[11rem] max-w-full text-left text-xs text-cherry-cola-100 wrap-anywhere lg:w-64">
              {footer.copyright}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
