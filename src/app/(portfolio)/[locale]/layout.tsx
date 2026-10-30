import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@/stylesheets/globals.css';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { ReadingPositionProvider } from '@/features/language-switcher/ui';

// This root contains document framing only. Per-page navigation never persists
// across a client transition while the body moves to another confirmed generation.
export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = localeSchema.safeParse((await params).locale);
  return (
    <html lang={locale.success ? locale.data : 'en'}>
      <body>
        <ReadingPositionProvider>{children}</ReadingPositionProvider>
      </body>
    </html>
  );
}
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
