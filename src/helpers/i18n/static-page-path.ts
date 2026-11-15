import type { Locale } from './locale.schema';

export function staticPagePath(locale: Locale, page: 'home' | 'cases' | 'about'): string {
  if (page === 'home') return `/${locale}`;
  return `/${locale}/${page === 'cases' ? 'cases' : locale === 'pt' ? 'sobre' : 'about'}`;
}
