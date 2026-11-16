import { pdfUploadFixture } from '../../../../testing/fixtures/media-uploads';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { preflightUpload } from './preflight-upload';

const png = () =>
  sharp({ create: { width: 2, height: 3, channels: 4, background: '#bada55' } })
    .png()
    .toBuffer();
const input = (bytes: Uint8Array, declaredType = 'image/png') => ({
  bytes,
  name: declaredType === 'application/pdf' ? 'synthetic.pdf' : 'synthetic.png',
  declaredType,
});
function padded(bytes: Uint8Array, length: number) {
  const result = new Uint8Array(length);
  result.set(bytes);
  return result;
}

describe('upload byte screening (not integrity validation)', () => {
  it('rejects SVG disguised as PNG before any decoder', () => {
    expect(
      preflightUpload(input(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))),
    ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  });
  it('rejects empty input with a clear message', () => {
    expect(preflightUpload(input(new Uint8Array(), 'application/pdf'))).toMatchObject({
      ok: false,
      error: { code: 'invalid-input', message: expect.stringMatching(/vazio/i) },
    });
  });
  it.each([
    { name: 'resume.txt', declaredType: 'application/pdf', bytes: pdfUploadFixture() },
    { name: 'resume.pdf', declaredType: 'application/octet-stream', bytes: pdfUploadFixture() },
    {
      name: 'resume.pdf',
      declaredType: 'application/pdf',
      bytes: new TextEncoder().encode('pretend pdf'),
    },
    {
      name: 'resume.pdf',
      declaredType: 'application/pdf',
      bytes: Uint8Array.from([37, 208, 68, 70, 45, 49, 46, 55]),
    },
  ])('rejects inconsistent PDF filename, MIME or signature: $name / $declaredType', (file) => {
    expect(preflightUpload(file)).toMatchObject({
      ok: false,
      error: { code: 'invalid-input', message: expect.stringMatching(/PDF/i) },
    });
  });
  it('accepts PDF extension and MIME casing without changing its bytes', () => {
    const bytes = pdfUploadFixture();
    expect(
      preflightUpload({ bytes, name: 'resume.PDF', declaredType: 'Application/PDF' }),
    ).toMatchObject({
      ok: true,
      value: { type: 'application/pdf', byteLength: bytes.byteLength },
    });
  });
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
  ] as const)('uses the real %s signature despite a generic name/type', async (format, type) => {
    const bytes = await sharp({
      create: { width: 2, height: 3, channels: 3, background: '#336699' },
    })
      .toFormat(format)
      .toBuffer();
    expect(
      preflightUpload({ bytes, name: 'incorrect.bin', declaredType: 'application/octet-stream' }),
    ).toMatchObject({ ok: true, value: { type, byteLength: bytes.byteLength } });
  });
  it('allows image screening at 10000000 bytes', async () => {
    expect(preflightUpload(input(padded(await png(), 10_000_000)))).toMatchObject({ ok: true });
  });
  it('rejects images at 10,000,001 bytes using actual bytes', async () => {
    expect(preflightUpload(input(padded(await png(), 10_000_001)))).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
  });
  it('allows PDF screening at 5000000 bytes', () => {
    expect(
      preflightUpload(input(padded(pdfUploadFixture(), 5_000_000), 'application/pdf')),
    ).toMatchObject({ ok: true, value: { type: 'application/pdf' } });
  });
  it('rejects PDFs at 5,000,001 bytes', () => {
    expect(
      preflightUpload(input(padded(pdfUploadFixture(), 5_000_001), 'application/pdf')),
    ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  });
});
