import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [measurementId, directory, ...extra] = process.argv.slice(2);
assert(
  measurementId && directory && extra.length === 0,
  'Pass a public measurement ID and a new fixture directory.',
);
assert.match(measurementId, /^G-[A-Z0-9]{4,32}$/);
const target = path.resolve(directory);
await fs.mkdir(target, { recursive: true });
const sourceUrl = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
// Only the static public script is downloaded here; this process never executes it.
const response = await fetch(sourceUrl, {
  method: 'GET',
  credentials: 'omit',
  headers: { Accept: 'application/javascript' },
  redirect: 'error',
  signal: AbortSignal.timeout(30000),
});
assert.equal(response.status, 200);
assert(/javascript/.test(response.headers.get('content-type') ?? ''));
const bytes = Buffer.from(await response.arrayBuffer());
assert(bytes.length > 100000 && bytes.length < 3000000);
const manifest = {
  version: 1,
  capturedAt: new Date().toISOString(),
  sourceUrl,
  httpStatus: response.status,
  contentType: response.headers.get('content-type'),
  byteLength: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  scope: 'Static official SDK download only; no collect/event endpoints requested.',
};
await fs.writeFile(path.join(target, 'gtag.js'), bytes, { flag: 'wx' });
await fs.writeFile(
  path.join(target, 'sdk-manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    status: 'static-sdk-captured',
    byteLength: bytes.length,
    sha256: manifest.sha256,
  }),
);
