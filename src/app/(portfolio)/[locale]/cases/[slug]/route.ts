import { caseRouteResponse } from '@/features/cases/server';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug } = await params;
  return caseRouteResponse(locale, slug);
}
