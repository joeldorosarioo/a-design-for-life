import 'server-only';
import { get, type IncomingMessage } from 'node:http';

import { publicGenerationHeader } from './public-generation-header';

export type PublicObservation = {
  path: string;
  status: number;
  matches: (bytes: Uint8Array, headers: Headers) => boolean;
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
const maxObservations = 64;
const generationPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const pathPattern = /^\/(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/;

function isLoopbackOrigin(origin: string): boolean {
  return (
    /^http:\/\/(?:127\.0\.0\.1|\[::1\])(?::[1-9]\d{0,4})?$/.test(origin) &&
    URL.parse(origin)?.origin === origin
  );
}

function readLocalResponse(url: string, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    // A one-off direct HTTP agent excludes ambient proxy settings and never follows redirects.
    const request = get(
      url,
      { agent: false, signal, headers: { 'Cache-Control': 'no-cache' } },
      resolve,
    );
    request.on('error', reject);
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

  const plan = observations.map(({ path, status, matches }) => ({ path, status, matches }));
  if (plan.some(({ path }) => path.length > 512 || !pathPattern.test(path)))
    throw new Error('Unsafe public HTTP verification plan.');

  const deadline = performance.now() + timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref();
  try {
    for (const observation of plan) {
      if (performance.now() >= deadline) throw new Error('Public observation deadline exceeded.');
      const response = await readLocalResponse(`${origin}${observation.path}`, controller.signal);
      try {
        const headers = responseHeaders(response);
        if (
          response.statusCode !== observation.status ||
          headers.get(publicGenerationHeader) !== generation
        )
          throw new Error('Unexpected public response metadata.');
        const bytes = await readCompleteBody(response, maxBodyBytes);
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
