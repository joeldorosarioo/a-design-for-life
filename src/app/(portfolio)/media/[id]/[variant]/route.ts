import { serveMedia } from '@/features/media-library/server';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; variant: string }> },
) {
  const { id, variant } = await context.params;
  return serveMedia({ mediaId: id, variant, preview: false }, request);
}
export const HEAD = GET;
