import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { userInfo } from 'node:os';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.match(await readFile('/etc/alpine-release', 'utf8'), /^3\.24\./);
assert.equal(process.version, 'v26.13.1');
assert.match(execFileSync('postgres', ['--version'], { encoding: 'utf8' }), / 17\.11\s*$/);
assert.equal(process.getuid(), 70);
assert.equal(process.getgid(), 70);
assert.equal(userInfo().username, 'appuser');
assert.equal(
  execFileSync('/opt/adfl-age/age', ['--version'], { encoding: 'utf8' }).trim(),
  'v1.3.2',
);
assert.match(
  execFileSync('/usr/bin/tar', ['--version'], { encoding: 'utf8' }),
  /^tar \(GNU tar\) 1\.35(?:\r?\n|$)/,
);
await access('/app/src/backup-runtime.mjs');
const buildIdentity = JSON.parse(await readFile('/app/ops/image/build-identity.json', 'utf8'));
assert.deepEqual(Object.keys(buildIdentity), ['revision']);
assert.match(buildIdentity.revision, /^(?:[a-f0-9]{40}|draft-[a-z0-9][a-z0-9.-]{0,100})$/);
const require = createRequire(import.meta.url);
const pdfPackage = require.resolve('pdfjs-dist/package.json');
const pdfRequire = createRequire(pdfPackage);
const { createCanvas } = pdfRequire('@napi-rs/canvas');
const canvas = createCanvas(32, 24);
canvas.getContext('2d').fillRect(0, 0, 32, 24);
assert.equal((await sharp(canvas.toBuffer('image/png')).metadata()).width, 32);

// This generated PDF contains no host fixture or editorial content.
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 32 24] /Resources << >> /Contents 4 0 R >>',
  '<< /Length 0 >>\nstream\n\nendstream',
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
for (const [index, object] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += 'xref\n0 5\n0000000000 65535 f \n';
pdf += offsets
  .slice(1)
  .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
  .join('');
pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const { getDocument } = await import(
  pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href
);
const task = getDocument({
  data: new Uint8Array(Buffer.from(pdf)),
  enableXfa: false,
  disableFontFace: true,
  useSystemFonts: false,
});
try {
  const document = await task.promise;
  assert.equal(document.numPages, 1);
} finally {
  await task.destroy();
}
console.log(
  'Verified Alpine 3.24, linux/amd64, UID/GID 70, Node 26.13.1, PostgreSQL 17.11, sharp, native canvas, PDF.js document loading, age 1.3.2, GNU tar 1.35 and backup entrypoint.',
);
