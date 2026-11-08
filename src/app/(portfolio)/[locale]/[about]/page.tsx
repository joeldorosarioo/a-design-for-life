import { publicPageMetadata, renderPublicPage } from '../../_components/public-page-response';
type Props = { params: Promise<{ locale: string; about: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, about } = await params;
  return publicPageMetadata('about', locale, `/${locale}/${about}`);
}
export default async function AboutPage({ params }: Props) {
  const { locale, about } = await params;
  return renderPublicPage('about', locale, `/${locale}/${about}`);
}
