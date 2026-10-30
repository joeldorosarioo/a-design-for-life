import type { NextRequest } from 'next/server';
import { resolveEntryLocale } from '@/features/language-switcher/server';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest): Response {
  const locale = resolveEntryLocale({
    savedLocale: request.cookies.get('portfolio_locale')?.value ?? null,
    acceptLanguage: request.headers.get('accept-language'),
  });
  return new Response(null, {
    status: 307,
    headers: { Location: `/${locale}`, 'Cache-Control': 'private, no-store' },
  });
}
