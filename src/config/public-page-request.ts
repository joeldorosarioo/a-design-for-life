import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { getPublishedCase, getPublishedCaseRoutes } from '@/features/cases/server';
import { publicRootDirectory } from '@/helpers/payload/public-root-directory';
import { installPayloadProvider } from '@/helpers/payload/runtime';
import { readServerEnv } from './server-env';
import { readPublicRenderContext, PUBLIC_RENDER_CONTEXT_HEADER } from './public-render-context';
import { readPublishedPortfolio } from './read-published-portfolio';

// Page/RSC can run in a different graph from Proxy/instrumentation. Install a
// factory only; a positive captured root never initializes the Native database.
installPayloadProvider(async () => {
  const [{ default: config }, { getPayload }] = await Promise.all([
    import('@payload-config'),
    import('payload'),
  ]);
  return getPayload({ config });
});

/** One request memo shared by body, metadata and not-found. Never reselects current. */
export const readPublicPageRequest = cache(async () => {
  const incoming = await headers();
  // Unknown URLs outside the public Proxy surface use Next's ordinary safe404.
  if (!incoming.has(PUBLIC_RENDER_CONTEXT_HEADER)) return null;
  const env = readServerEnv(process.env);
  const verified = await readPublicRenderContext(new Headers(incoming), {
    publicationDirectory: publicRootDirectory(env),
    secret: env.PAYLOAD_SECRET,
  });
  const { context, root } = verified;
  const composed = await readPublishedPortfolio(context.locale, root);
  const portfolio = composed.ok ? composed.value : null;
  const match = /^\/(pt|en)\/cases\/([^/]+)$/.exec(context.pathname);
  const caseResult =
    context.status === 200 && match ? await getPublishedCase(context.locale, match[2], root) : null;
  const detail = caseResult?.ok ? caseResult.value : undefined;
  if (context.status === 200 && (match ? !detail : !portfolio))
    throw new Error('Pinned public page does not match the verified response.');
  const [ptRoutes, enRoutes] = await Promise.all([
    getPublishedCaseRoutes('pt', root),
    getPublishedCaseRoutes('en', root),
  ]);
  const routes = ptRoutes.ok && enRoutes.ok ? [...ptRoutes.value, ...enRoutes.value] : [];
  return {
    context,
    root,
    portfolio,
    detail,
    routes,
    origin: env.SITE_ORIGIN,
    indexable: env.APP_ENV === 'production',
  };
});
