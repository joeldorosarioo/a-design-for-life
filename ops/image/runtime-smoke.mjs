import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
assert.match(await readFile('/etc/alpine-release', 'utf8'), /^3\.24\./);
assert.equal(process.version, 'v24.22.2');
assert.match(execFileSync('postgres', ['--version'], { encoding: 'utf8' }), / 17\.11\s*$/);
assert.equal(process.getuid(), 70);
assert.equal(process.getgid(), 70);
const checker = process.env.MEDIA_CHECKER_BINARY ?? '/opt/qpdf/bin/qpdf';
assert.match(execFileSync(checker, ['--version'], { encoding: 'utf8' }), /^qpdf version 12\.4\.2/);
const require = createRequire(import.meta.url);
const pdfPackage = require.resolve('pdfjs-dist/package.json');
const resources = path.dirname(pdfPackage);
for (const directory of ['cmaps', 'standard_fonts', 'wasm'])
  await access(path.join(resources, directory));
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
const directory = await mkdtemp(path.join(tmpdir(), 'adfl-image-smoke-'));
try {
  const input = path.join(directory, 'synthetic.pdf');
  await writeFile(input, pdf);
  execFileSync(checker, ['--check', input], { stdio: 'pipe' });
  const { getDocument } = await import(
    pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href
  );
  const task = getDocument({
    data: new Uint8Array(Buffer.from(pdf)),
    cMapUrl: resources + '/cmaps/',
    standardFontDataUrl: resources + '/standard_fonts/',
    wasmUrl: resources + '/wasm/',
    useSystemFonts: false,
  });
  const document = await task.promise;
  try {
    const page = await document.getPage(1);
    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport: page.getViewport({ scale: 1 }),
    }).promise;
    assert.equal(document.numPages, 1);
  } finally {
    await task.destroy();
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(
  'Verified Alpine 3.24, linux/amd64, UID/GID 70, Node 24.22.2, PostgreSQL 17.11, QPDF 12.4.2, sharp, native canvas and PDF.js resources.',
);
