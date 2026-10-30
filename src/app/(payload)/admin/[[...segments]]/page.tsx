import { EDITORIAL_RENDER_REVISION } from '@/helpers/payload/editorial-revision';
import { handleServerFunctions } from '@payloadcms/next/layouts';
import { openEditorialDocument } from '@/helpers/payload/editorial-native';
// Maintained application facade around the public native Payload RootPage.
import type { Metadata } from 'next';

import config from '@payload-config';
import { RootPage, generatePageMetadata } from '@payloadcms/next/views';
import { importMap } from '../importMap';

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams });

const Page = async ({ params, searchParams }: Args) => {
  const { segments = [] } = await params;
  let observedSearchParams = searchParams;
  if (segments[0] === 'collections' && segments[2] && segments[2] !== 'create') {
    const opened = await handleServerFunctions({
      config,
      importMap,
      name: 'editorial-open',
      args: { collectionSlug: segments[1], id: segments[2] },
      serverFunctions: { 'editorial-open': openEditorialDocument },
    });
    if (
      opened &&
      typeof opened === 'object' &&
      'revision' in opened &&
      typeof opened.revision === 'string'
    )
      observedSearchParams = Promise.resolve({
        ...(await searchParams),
        [EDITORIAL_RENDER_REVISION]: opened.revision,
      });
  }
  return RootPage({ config, params, searchParams: observedSearchParams, importMap });
};

export default Page;
