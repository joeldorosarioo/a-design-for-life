import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CollectionConfig, PayloadRequest } from 'payload';
import { z } from 'zod';
import type { PublicRoot } from '../../src/helpers/payload/public-root';
import {
  installPublicationProvider,
  runtimePublication,
} from '../../src/helpers/payload/publication-runtime';

export function publishedFixtureEntry(value: unknown): PublicRoot['subjects'][string] {
  return { operationId: randomUUID(), targetRevision: randomUUID(), value: z.json().parse(value) };
}

export async function withPublishedEndpointRoot(
  run: (fixture: {
    current: string;
    write: (root: PublicRoot) => Promise<void>;
    selections: () => number;
  }) => Promise<void>,
) {
  let previous: ReturnType<typeof runtimePublication> | undefined;
  try {
    previous = runtimePublication();
  } catch {
    // A standalone endpoint unit test may have no application composition.
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'published-endpoint-'));
  const current = path.join(directory, 'current.json');
  let selections = 0;
  installPublicationProvider(() => {
    selections++;
    return {
      directory,
      retry: async () => {
        throw new Error('Unexpected publication write');
      },
    };
  });
  try {
    await run({
      current,
      write: (root) => writeFile(current, JSON.stringify(root)),
      selections: () => selections,
    });
  } finally {
    installPublicationProvider(() => {
      if (!previous)
        throw new Error('Publication provider must be installed by application composition.');
      return previous;
    });
    if (
      path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith('published-endpoint-')
    )
      throw new Error('Refusing cleanup outside the owned endpoint fixture.');
    await rm(directory, { recursive: true, force: true });
  }
}

export function publicEndpointRequest(locale: string): PayloadRequest {
  return {
    user: null,
    routeParams: { locale },
    headers: new Headers({ 'x-portfolio-generation': 'untrusted' }),
    payload: {
      db: {
        count: async () => {
          throw new Error('No Native database in this fixture');
        },
      },
    },
  } as unknown as PayloadRequest;
}

export function publishedLocaleHandler(collection: CollectionConfig) {
  if (!collection.endpoints) return undefined;
  return collection.endpoints.find(
    (endpoint) => endpoint.method === 'get' && endpoint.path === '/published/:locale',
  )?.handler;
}
