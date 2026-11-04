import 'server-only';
import { request, type IncomingMessage } from 'node:http';

import { publicGenerationHeader } from './public-generation-header';

export type PublicObservation = {
  path: string;
  status: number;
  matches: (bytes: Uint8Array, headers: Headers) => boolean;
  media?: {
    kind: 'direct' | 'optimizer';
    mode: 'get' | 'head' | 'range';
    maxBodyBytes: number;
  };
};

export type PublicVerification = {
  origin: string;
  generation: string;
  observations: readonly PublicObservation[];
  timeoutMs?: number;
  maxBodyBytes?: number;
};

const totalDeadlineMs = 5_000;
const responseLimit = 2 * 1024 * 1024;
const mediaResponseLimit = 16 * 1024 * 1024;
const maxObservations = 64;
const generationPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const pathPattern = /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/;
const uuidPath = '[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const directPath = new RegExp(`^/media/${uuidPath}/(?:original|w[1-9]\\d{0,7})$`);
const optimizerQuery = '&w=64&q=75';
const optimizerPath = new RegExp(
  `^/_next/image\\?url=%2Fmedia%2F${uuidPath}%2Foriginal${optimizerQuery}$`,
);

export function publicOptimizerObservationPath(mediaId: string): string {
  return `/_next/image?url=${encodeURIComponent(`/media/${mediaId}/original`)}${optimizerQuery}`;
}

function isLoopbackOrigin(origin: string): boolean {
  return (
    /^http:\/\/(?:127\.0\.0\.1|\[::1\])(?::[1-9]\d{0,4})?$/.test(origin) &&
    URL.parse(origin)?.origin === origin
  );
}

function prepareObservation(
  { path, status, matches, media }: PublicObservation,
  bodyLimit: number,
) {
  if (path.length > 512 || path.trim() !== path)
    throw new Error('Unsafe public HTTP verification plan.');

  const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
  if (!media) {
    if (!pathPattern.test(path)) throw new Error('Unsafe public HTTP verification plan.');
    return { path, status, matches, method: 'GET', headers, bodyLimit };
  }

  const { kind, mode, maxBodyBytes } = media;
  if (
    !(
      (kind === 'direct' && directPath.test(path)) ||
      (kind === 'optimizer' && optimizerPath.test(path))
    ) ||
    !['get', 'head', 'range'].includes(mode) ||
    !Number.isSafeInteger(maxBodyBytes) ||
    !(
      (status === 404 && maxBodyBytes === 0) ||
      (status === 200 && mode === 'get' && maxBodyBytes > 0 && maxBodyBytes <= mediaResponseLimit)
    )
  ) {
    throw new Error('Unsafe public HTTP verification plan.');
  }
  if (mode === 'range') headers.Range = 'bytes=0-15';
  if (kind === 'optimizer') headers.Accept = 'image/webp';
  return {
    path,
    status,
    matches,
    method: mode === 'head' ? 'HEAD' : 'GET',
    headers,
    bodyLimit: maxBodyBytes,
  };
}

function readLocalResponse(
  url: string,
  signal: AbortSignal,
  method: string,
  headers: Record<string, string>,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    // A one-off direct HTTP agent excludes ambient proxy settings and never follows redirects.
    const outgoing = request(url, { agent: false, signal, method, headers }, resolve);
    outgoing.on('error', reject);
    outgoing.end();
  });
}

function responseHeaders(response: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, values] of Object.entries(response.headersDistinct)) {
    for (const value of values ?? []) headers.append(name, value);
  }
  return headers;
}

async function readCompleteBody(response: IncomingMessage, limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response as AsyncIterable<Buffer>) {
    size += chunk.byteLength;
    if (size > limit) throw new Error('Public response exceeded the byte limit.');
    chunks.push(chunk);
  }
  if (!response.complete) throw new Error('Public response was incomplete.');
  return Buffer.concat(chunks, size);
}

export async function assertServedPublication({
  origin,
  generation,
  observations,
  timeoutMs = totalDeadlineMs,
  maxBodyBytes = responseLimit,
}: PublicVerification): Promise<void> {
  if (
    !isLoopbackOrigin(origin) ||
    !generationPattern.test(generation) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > totalDeadlineMs ||
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 1 ||
    maxBodyBytes > responseLimit ||
    !observations.length ||
    observations.length > maxObservations
  ) {
    throw new Error('Unsafe public HTTP verification plan.');
  }

  const plan = observations.map((observation) => prepareObservation(observation, maxBodyBytes));

  const deadline = performance.now() + timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref();
  try {
    for (const observation of plan) {
      if (performance.now() >= deadline) throw new Error('Public observation deadline exceeded.');
      const response = await readLocalResponse(
        `${origin}${observation.path}`,
        controller.signal,
        observation.method,
        observation.headers,
      );
      try {
        const headers = responseHeaders(response);
        if (
          response.statusCode !== observation.status ||
          headers.get(publicGenerationHeader) !== generation
        )
          throw new Error('Unexpected public response metadata.');
        const bytes = await readCompleteBody(response, observation.bodyLimit);
        if (observation.matches(bytes, headers) !== true)
          throw new Error('Unexpected public response projection.');
      } finally {
        if (!response.complete) response.destroy();
      }
    }
    if (performance.now() >= deadline) throw new Error('Public observation deadline exceeded.');
  } catch {
    // Callers can report a stable diagnostic without echoing paths, payloads or provider errors.
    throw new Error('Public HTTP verification failed.');
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
