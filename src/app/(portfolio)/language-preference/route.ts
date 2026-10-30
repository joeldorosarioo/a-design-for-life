import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readServerEnv } from '@/config/server-env';
import { localeSchema } from '@/helpers/i18n/locale.schema';
import { setLanguagePreference } from '@/features/language-switcher/server';

const preferenceSchema = z.strictObject({ locale: localeSchema });
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request): Promise<Response> {
  const { SITE_ORIGIN: siteOrigin } = readServerEnv(process.env);
  if (request.headers.get('origin') !== new URL(siteOrigin).origin)
    return new Response(null, { status: 403, headers });
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return new Response(null, { status: 400, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const input = preferenceSchema.safeParse(body);
  if (!input.success) return new Response(null, { status: 400, headers });

  const response = new NextResponse(null, { status: 204, headers });
  setLanguagePreference(input.data.locale, response, { siteOrigin });
  return response;
}
