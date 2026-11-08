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
  name: 'synthetic.png',
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
  it('rejects a fabricated PDF and empty input', () => {
    for (const bytes of [new Uint8Array(), new TextEncoder().encode('pretend pdf')])
      expect(preflightUpload(input(bytes, 'application/pdf'))).toMatchObject({
        ok: false,
        error: { code: 'invalid-input' },
      });
  });
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
  ] as const)('uses the real %s signature despite an incorrect name/type', async (format, type) => {
    const bytes = await sharp({
      create: { width: 2, height: 3, channels: 3, background: '#336699' },
    })
      .toFormat(format)
      .toBuffer();
    expect(
      preflightUpload({ bytes, name: 'incorrect.pdf', declaredType: 'application/pdf' }),
    ).toMatchObject({ ok: true, value: { type, byteLength: bytes.byteLength } });
  });
  it.each([9_999_999, 10_000_000])('allows image screening at %i bytes', async (length) => {
    expect(preflightUpload(input(padded(await png(), length)))).toMatchObject({ ok: true });
  });
  it('rejects images at 10,000,001 bytes using actual bytes', async () => {
    expect(preflightUpload(input(padded(await png(), 10_000_001)))).toMatchObject({
      ok: false,
      error: { code: 'invalid-input' },
    });
  });
  it.each([4_999_999, 5_000_000])('allows PDF screening at %i bytes', (length) => {
    expect(
      preflightUpload(input(padded(pdfUploadFixture(), length), 'application/pdf')),
    ).toMatchObject({ ok: true, value: { type: 'application/pdf' } });
  });
  it('rejects PDFs at 5,000,001 bytes', () => {
    expect(
      preflightUpload(input(padded(pdfUploadFixture(), 5_000_001), 'application/pdf')),
    ).toMatchObject({ ok: false, error: { code: 'invalid-input' } });
  });
});
