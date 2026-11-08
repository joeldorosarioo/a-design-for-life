import {
  encryptedPdfUploadFixture,
  mediaCheckerFixturePath,
  pdfUploadFixture,
} from '../../../../testing/fixtures/media-uploads';
import { expect, it } from 'vitest';
const checkerBinary = mediaCheckerFixturePath();
import { inspectPdf } from './inspect-pdf';

it('rejects a fabricated PDF that satisfies native prefix/trailer markers', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\nnot a document\nxref\n%%EOF');
  expect(await inspectPdf(bytes, { checkerBinary })).toEqual({ kind: 'invalid' });
});
it('loads all pages and preserves original input bytes', async () => {
  const bytes = pdfUploadFixture();
  const original = bytes.slice();
  expect(await inspectPdf(bytes, { checkerBinary })).toEqual({ kind: 'valid', pages: 3 });
  expect(bytes).toEqual(original);
});
it('examines an invalid intermediate page, not only the first and last', async () => {
  expect(await inspectPdf(pdfUploadFixture({ middleInvalid: true }), { checkerBinary })).toEqual({
    kind: 'invalid',
  });
});
it('examines page streams, not only page count', async () => {
  expect(await inspectPdf(pdfUploadFixture({ brokenStream: true }), { checkerBinary })).toEqual({
    kind: 'invalid',
  });
});
it('honors request cancellation before starting a parser', async () => {
  expect(
    await inspectPdf(pdfUploadFixture(), { checkerBinary, signal: AbortSignal.abort() }),
  ).toEqual({ kind: 'cancelled' });
});

it('accepts encrypted PDF that opens with an empty password', async () => {
  expect(await inspectPdf(await encryptedPdfUploadFixture(''), { checkerBinary })).toEqual({
    kind: 'valid',
    pages: 3,
  });
});
it('distinguishes a missing required password from invalid structure without banning all encryption', async () => {
  expect(
    await inspectPdf(await encryptedPdfUploadFixture('synthetic-user-password'), { checkerBinary }),
  ).toEqual({ kind: 'password-required' });
});
it('terminates the parser when a live request is cancelled', async () => {
  const controller = new AbortController();
  const inspection = inspectPdf(pdfUploadFixture(), { checkerBinary, signal: controller.signal });
  controller.abort();
  expect(await inspection).toEqual({ kind: 'cancelled' });
});

it('reports recoverable checker warnings explicitly instead of calling them clean integrity', async () => {
  const recovered = new TextDecoder()
    .decode(pdfUploadFixture())
    .replace(/startxref\n\d+/, 'startxref\n1');
  expect(await inspectPdf(new TextEncoder().encode(recovered), { checkerBinary })).toEqual({
    kind: 'warnings',
    pages: 3,
  });
});
it('distinguishes unavailable checker infrastructure from invalid user bytes', async () => {
  expect(
    await inspectPdf(pdfUploadFixture(), { checkerBinary: 'adfl-nonexistent-checker' }),
  ).toEqual({ kind: 'unavailable' });
});

it('inspects native Buffer input without detaching or changing its original bytes', async () => {
  const bytes = Buffer.from(pdfUploadFixture());
  const original = Buffer.from(bytes);
  expect(await inspectPdf(bytes, { checkerBinary })).toEqual({ kind: 'valid', pages: 3 });
  expect(bytes).toEqual(original);
});

it('checks the same captured bytes when the caller mutates its input while parsing', async () => {
  const bytes = pdfUploadFixture();
  const inspection = inspectPdf(bytes, { checkerBinary });
  bytes.fill(0);
  expect(await inspection).toEqual({ kind: 'valid', pages: 3 });
});
