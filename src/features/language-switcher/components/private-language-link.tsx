import { Button } from '@/components/ui/button';
import type { Locale } from '@/helpers/i18n/locale.schema';
import { parsePrivatePreviewPath } from '@/helpers/payload/private-preview-path';
import { LanguageFlag, languageButtonClass } from './language-flag';
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
  const flag = <LanguageFlag locale={locale} />;
  return href === null ? (
    <Button
      className={languageButtonClass}
      disabled
      aria-label={label}
      lang={target}
      title={`${languageLabel}: ${label}`}
    >
      {flag}
    </Button>
  ) : (
    <Button asChild className={languageButtonClass}>
      <a href={href} aria-label={label} lang={target} title={`${languageLabel}: ${label}`}>
        {flag}
      </a>
    </Button>
  );
}
