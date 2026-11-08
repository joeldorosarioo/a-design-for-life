import type { NavigationPresentation } from '../contracts/navigation-presentation';
import { Button } from '@/components/ui/button';
import styles from '../stylesheets/navigation.module.css';

export function SiteFooter({ navigation }: { navigation: NavigationPresentation }) {
  const { footer, contacts, brand, controls } = navigation;
  return (
    <footer className={styles.footer}>
      <div className={`portfolio-container ${styles.footerInner}`}>
        {footer.eyebrow && <p className={styles.footerEyebrow}>{footer.eyebrow}</p>}
        {footer.title && <h2 className={styles.footerTitle}>{footer.title}</h2>}
        {footer.description && <p className={styles.footerDescription}>{footer.description}</p>}
        <ul
          id="contact"
          data-reading-key="site-contact"
          tabIndex={-1}
          aria-label={navigation.items[3].label}
          className={styles.contactList}
        >
          <li>
            <Button asChild>
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
          className={styles.footerDivider}
          src="/figma/footer-divider.svg"
          width={1280}
          height={1}
          alt=""
        />
        <div className={styles.footerMeta}>
          <a className={styles.footerBrand} href={brand.href}>
            {brand.label}
          </a>
          {footer.copyright && <p className={styles.copyright}>{footer.copyright}</p>}
        </div>
      </div>
    </footer>
  );
}
