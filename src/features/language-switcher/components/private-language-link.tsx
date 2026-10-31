import { Button, buttonVariants } from '@/components/ui/button';
import type { Locale } from '@/helpers/i18n/locale.schema';
import { parsePrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import styles from '../stylesheets/language-switcher.module.css';
export function PrivateLanguageLink({
  locale,
  href,
  languageLabel,
}: {
  locale: Locale;
  href: string | null;
  languageLabel: string;
}) {
  const target = locale === 'pt' ? 'en' : 'pt';
  const label = target === 'en' ? 'English' : 'Português';
  if (href !== null && parsePrivatePreviewPath(href).locale !== target)
    throw new TypeError('Private language link must target the counterpart locale.');
  const flag = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- exact approved static Figma language vector */}
      <img
        src={target === 'en' ? '/figma/language-en.svg' : '/figma/language-br.svg'}
        width={32}
        height={32}
        alt=""
      />
    </>
  );
  return href === null ? (
    <Button
      className={styles.toggle}
      disabled
      aria-label={label}
      lang={target}
      title={`${languageLabel}: ${label}`}
    >
      {flag}
    </Button>
  ) : (
    <a
      className={buttonVariants({ variant: 'secondary', className: styles.toggle })}
      href={href}
      aria-label={label}
      lang={target}
      title={`${languageLabel}: ${label}`}
    >
      {flag}
    </a>
  );
}
