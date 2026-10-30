import './editorial-admin.css';
import { editorialFormState, openEditorialDocument } from '@/helpers/payload/editorial-native';
// Maintained application facade around native Payload server functions.
import config from '@payload-config';
import '@payloadcms/next/css';
import type { ServerFunctionClient } from 'payload';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import React from 'react';

import { importMap } from './admin/importMap.js';

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  'use server';
  return handleServerFunctions({
    ...args,
    config,
    importMap,
    serverFunctions: {
      'form-state': editorialFormState,
      'render-document': async (nativeArgs) => {
        await openEditorialDocument({ ...nativeArgs, id: nativeArgs.docID });
        return handleServerFunctions({
          name: 'render-document',
          args: { ...args.args },
          config,
          importMap,
        });
      },
    },
  });
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
);

export default Layout;
