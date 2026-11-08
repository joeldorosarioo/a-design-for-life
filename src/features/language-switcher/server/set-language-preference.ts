import 'server-only';

import type { NextResponse } from 'next/server';

import { localeSchema } from '@/helpers/i18n/locale.schema';

export type LanguagePreferenceContext = { siteOrigin: string };
export type LanguagePreferenceResponse = { cookies: Pick<NextResponse['cookies'], 'set'> };

/** Called only for a manual choice; entry resolution and visits must never call this writer. */
export function setLanguagePreference(
  locale: unknown,
  response: LanguagePreferenceResponse,
  { siteOrigin }: LanguagePreferenceContext,
): void {
  const preference = localeSchema.parse(locale);
  if (!URL.canParse(siteOrigin)) throw new TypeError('Expected an HTTP(S) site origin');
  const origin = new URL(siteOrigin);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    throw new TypeError('Expected an HTTP(S) site origin without path or credentials');
  }

  response.cookies.set('portfolio_locale', preference, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: origin.protocol === 'https:',
    maxAge: 15552000,
  });
}
