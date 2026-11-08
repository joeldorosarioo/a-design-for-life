import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@/stylesheets/globals.css';
import { localeSchema } from '@/helpers/i18n/locale.schema';

export default async function PreviewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = localeSchema.parse((await params).locale);
  return (
    <html lang={locale}>
      <body className="portfolio-body portfolio-focus">{children}</body>
    </html>
  );
}
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: null,
  openGraph: null,
  twitter: null,
};
export const dynamic = 'force-dynamic';
