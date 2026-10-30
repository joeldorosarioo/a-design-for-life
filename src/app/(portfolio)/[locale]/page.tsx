import { publicPageMetadata, renderPublicPage } from '../_components/public-page-response';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return publicPageMetadata('home', locale, `/${locale}`);
}
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  return renderPublicPage('home', locale, `/${locale}`);
}
