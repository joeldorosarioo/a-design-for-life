import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { localeSchema, type Locale } from '@/helpers/i18n/locale.schema';
import { readPublicRoot, type PublicRoot } from '@/helpers/payload/public-root';
import { publicGenerationHeader } from '@/helpers/payload/public-generation-header';
import { pinPublicRoot, readPinnedPublicRoot } from '@/helpers/payload/render-snapshot';
import { runtimePayload } from '@/helpers/payload/runtime';
import { publishedReadStatus } from '@/helpers/payload/published-read-response';
import { slugSchema } from '@/features/cases';
import {
  getPublishedCase,
  resolveCaseRoute,
  selectCaseStatePresentation,
  type CaseStatePresentation,
} from '@/features/cases/server';
import { getPublishedProfile } from '@/features/professional-profile/server';
import { getPublishedNavigation, resolveNavigation } from '@/features/site-navigation/server';
import { readPublishedPortfolio } from './read-published-portfolio';

export const PUBLIC_RENDER_CONTEXT_HEADER = 'x-portfolio-render-context';
export type PublicRenderOptions = { publicationDirectory: string; secret: string };
export type PublicRenderDecision = (
  | { status: 308; location: string }
  | { status: 405 }
  | {
      status: 404 | 410 | 503;
      caseStateLocale: Locale;
      caseStatePresentation?: CaseStatePresentation;
    }
  | { status: 200 | 404 | 410 | 503; requestHeaders: Headers }
) & { generation?: string };
type PublicRoute = {
  locale: Locale;
  pathname: string;
  kind: 'page' | 'detail' | 'invalid';
  slug?: string;
};

function publicRoute(pathname: string): PublicRoute | null {
  const parts = pathname.split('/');
  const locale = localeSchema.safeParse(parts[1]);
  if (!locale.success) return null;
  // Every supported locale prefix carries its own safe404 context, including
  // unknown paths. Other app surfaces remain outside this transport.
  let normalized = pathname;
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    if (decoded.some((part) => /[\\/\u0000-\u001f\u007f]/.test(part)))
      return { locale: locale.data, pathname, kind: 'invalid' };
    normalized = decoded.join('/');
  } catch {
    return { locale: locale.data, pathname, kind: 'invalid' };
  }
  const home = `/${locale.data}`;
  if (
    [home, `${home}/cases`, `${home}/${locale.data === 'pt' ? 'sobre' : 'about'}`].includes(
      normalized,
    )
  )
    return { locale: locale.data, pathname: normalized, kind: 'page' };
  const decodedParts = normalized.split('/');
  if (
    decodedParts.length === 4 &&
    decodedParts[2] === 'cases' &&
    slugSchema.safeParse(decodedParts[3]).success
  )
    return { locale: locale.data, pathname: normalized, kind: 'detail', slug: decodedParts[3] };
  return { locale: locale.data, pathname: normalized, kind: 'invalid' };
}

const contextSchema = z
  .strictObject({
    v: z.literal(1),
    method: z.enum(['GET', 'HEAD']),
    pathname: z.string().max(1024),
    locale: localeSchema,
    status: z.union([z.literal(200), z.literal(404), z.literal(410), z.literal(503)]),
    pin: z
      .strictObject({
        generation: z.uuid().regex(/^[0-9a-f-]+$/),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .nullable(),
  })
  .refine((context) => {
    const route = publicRoute(context.pathname);
    return (
      route?.locale === context.locale &&
      route.pathname === context.pathname &&
      (context.status !== 200 || (context.pin !== null && route.kind !== 'invalid')) &&
      (context.status !== 410 || (context.pin !== null && route.kind === 'detail'))
    );
  }, 'Inconsistent public render context.');
export type PublicRenderContext = z.infer<typeof contextSchema>;

function signature(encoded: string, secret: string) {
  if (secret.length < 32) throw new Error('Invalid public render secret.');
  return createHmac('sha256', secret)
    .update(`portfolio-public-render-context-v1\n${encoded}`)
    .digest();
}
function cleanHeaders(input: Headers) {
  const headers = new Headers(input);
  for (const name of [...headers.keys()])
    if (
      name === publicGenerationHeader ||
      name === `x-middleware-request-${publicGenerationHeader}` ||
      name.startsWith('x-portfolio-render-') ||
      name.startsWith('x-middleware-request-x-portfolio-render-') ||
      name === 'x-middleware-override-headers'
    )
      headers.delete(name);
  return headers;
}
function signedHeaders(
  request: Request,
  context: PublicRenderContext,
  options: PublicRenderOptions,
) {
  const encoded = Buffer.from(JSON.stringify(contextSchema.parse(context))).toString('base64url');
  const token = `${encoded}.${signature(encoded, options.secret).toString('hex')}`;
  if (token.length > 2048) throw new Error('Public render context too large.');
  const headers = cleanHeaders(request.headers);
  headers.set(PUBLIC_RENDER_CONTEXT_HEADER, token);
  return headers;
}
function usablePortfolio(result: Awaited<ReturnType<typeof readPublishedPortfolio>>) {
  if (!result.ok) return false;
  resolveNavigation({
    locale: result.value.locale,
    navigation: result.value.navigation,
    profile: result.value.profile,
  });
  return true;
}
async function structuralFailure(locale: Locale, root: PublicRoot | null): Promise<404 | 503> {
  const [profile, navigation] = await Promise.all([
    getPublishedProfile(locale, undefined, root),
    getPublishedNavigation(locale, undefined, root),
  ]);
  const missing = [
    { result: profile, collection: 'professional-profiles' as const },
    { result: navigation, collection: 'site-navigation' as const },
  ].filter((item) => !item.result.ok);
  if (!missing.length) return 503;
  try {
    const payload = await runtimePayload();
    const statuses = await Promise.all(
      missing.map((item) =>
        publishedReadStatus<unknown>(
          item.result,
          { collection: item.collection, where: { locale: { equals: locale } } },
          payload,
        ),
      ),
    );
    return statuses.includes(503) ? 503 : 404;
  } catch {
    return 503;
  }
}

async function directCaseState(
  status: 404 | 410 | 503,
  locale: Locale,
  root: PublicRoot | null,
): Promise<PublicRenderDecision> {
  // Presentation cannot elect a new root or change an authoritative status.
  const presentation = await selectCaseStatePresentation({ status, locale, root }).catch(
    () => null,
  );
  return {
    status,
    caseStateLocale: locale,
    ...(root && status !== 404 ? { generation: root.generation } : {}),
    ...(presentation ? { caseStatePresentation: presentation } : {}),
  };
}
/** Select current exactly once; a pin transports that selection, never elects a generation. */
export async function preparePublicRenderRequest(
  request: Request,
  options: PublicRenderOptions,
): Promise<PublicRenderDecision | null> {
  const route = publicRoute(new URL(request.url).pathname);
  if (!route) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return { status: 405 };
  if (route.kind === 'invalid' && /^\/(?:pt|en)\/cases\/.+/.test(route.pathname)) {
    let captured: PublicRoot | null = null;
    try {
      captured = await readPublicRoot(options.publicationDirectory);
    } catch {
      /* Preserve the closed path404 and A1 fallback. */
    }
    return directCaseState(404, route.locale, captured);
  }
  let root: PublicRoot | null = null;
  let status: PublicRenderContext['status'] = route.kind === 'invalid' ? 404 : 503;
  let pin: PublicRenderContext['pin'] = null;
  if (route.kind !== 'invalid') {
    try {
      root = await readPublicRoot(options.publicationDirectory);
      if (route.kind === 'detail') {
        const resolution = await resolveCaseRoute(route.locale, route.slug!, undefined, root);
        if (resolution.status === 308) return { ...resolution, generation: root?.generation };
        status = resolution.status;
        if (status === 200 && !(await getPublishedCase(route.locale, route.slug!, root)).ok)
          status = 503;
      } else {
        const portfolio = await readPublishedPortfolio(route.locale, root);
        status = usablePortfolio(portfolio) ? 200 : await structuralFailure(route.locale, root);
      }
      if (route.kind === 'detail' && status !== 200)
        return directCaseState(status, route.locale, root);
      if (root) pin = await pinPublicRoot(options.publicationDirectory, root);
    } catch {
      root = null;
      pin = null;
      status = 503;
    }
  }
  if (route.kind === 'detail' && status !== 200) return directCaseState(status, route.locale, root);
  const context = contextSchema.parse({
    v: 1,
    method: request.method,
    pathname: route.pathname,
    locale: route.locale,
    status,
    pin,
  });
  return {
    status,
    requestHeaders: signedHeaders(request, context, options),
    generation: pin?.generation,
  };
}

/** No fresh-root fallback and no cross-request memoization. Page composition owns React.cache. */
export async function readPublicRenderContext(
  headers: Headers,
  options: PublicRenderOptions,
  expected?: { pathname: string; method?: 'GET' | 'HEAD' },
): Promise<{ context: PublicRenderContext; root: PublicRoot | null }> {
  const token = headers.get(PUBLIC_RENDER_CONTEXT_HEADER);
  if (!token || token.length > 2048) throw new Error('Missing public render context.');
  const match = /^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(token);
  if (!match || !timingSafeEqual(Buffer.from(match[2], 'hex'), signature(match[1], options.secret)))
    throw new Error('Invalid public render context signature.');
  const bytes = Buffer.from(match[1], 'base64url');
  if (bytes.toString('base64url') !== match[1]) throw new Error('Invalid public render encoding.');
  const context = contextSchema.parse(JSON.parse(bytes.toString('utf8')));
  if (
    expected &&
    (context.pathname !== expected.pathname ||
      (expected.method !== undefined && context.method !== expected.method))
  )
    throw new Error('Public render context does not match request.');
  const root = context.pin
    ? await readPinnedPublicRoot(options.publicationDirectory, context.pin)
    : null;
  return { context, root };
}
