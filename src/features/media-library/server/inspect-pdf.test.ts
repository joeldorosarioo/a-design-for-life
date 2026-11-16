import {
  encryptedPdfUploadFixture,
  pdfUploadFixture,
} from '../../../../testing/fixtures/media-uploads';
import { expect, it } from 'vitest';
import { inspectPdf } from './inspect-pdf';

it('rejects a fabricated PDF that satisfies native prefix/trailer markers', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\nnot a document\nxref\n%%EOF');
  expect(await inspectPdf(bytes)).toEqual({ kind: 'invalid' });
});
it('loads the document and preserves original input bytes', async () => {
  const bytes = pdfUploadFixture();
  const original = bytes.slice();
  expect(await inspectPdf(bytes)).toEqual({ kind: 'valid', pages: 3 });
  expect(bytes).toEqual(original);
});
it('does not decode page streams after loading the document', async () => {
  expect(await inspectPdf(pdfUploadFixture({ brokenStream: true }))).toEqual({
    kind: 'valid',
    pages: 3,
  });
});
it('honors request cancellation before starting a parser', async () => {
  expect(await inspectPdf(pdfUploadFixture(), AbortSignal.abort())).toEqual({ kind: 'cancelled' });
});

it('accepts encrypted PDF that opens with an empty password', async () => {
  expect(await inspectPdf(encryptedPdfUploadFixture(false))).toEqual({
    kind: 'valid',
    pages: 3,
  });
});
it('distinguishes a missing required password from invalid structure without banning all encryption', async () => {
  expect(await inspectPdf(encryptedPdfUploadFixture(true))).toEqual({
    kind: 'password-required',
  });
});
it('cancels document loading when the request is aborted', async () => {
  const controller = new AbortController();
  const inspection = inspectPdf(pdfUploadFixture(), controller.signal);
  controller.abort();
  expect(await inspection).toEqual({ kind: 'cancelled' });
});

it('accepts a document that PDF.js can load with a recovered cross-reference table', async () => {
  const recovered = new TextDecoder()
    .decode(pdfUploadFixture())
    .replace(/startxref\n\d+/, 'startxref\n1');
  expect(await inspectPdf(new TextEncoder().encode(recovered))).toEqual({
    kind: 'valid',
    pages: 3,
  });
});
it('inspects native Buffer input without detaching or changing its original bytes', async () => {
  const bytes = Buffer.from(pdfUploadFixture());
  const original = Buffer.from(bytes);
  expect(await inspectPdf(bytes)).toEqual({ kind: 'valid', pages: 3 });
  expect(bytes).toEqual(original);
});

it('checks the same captured bytes when the caller mutates its input while parsing', async () => {
  const bytes = pdfUploadFixture();
  const inspection = inspectPdf(bytes);
  bytes.fill(0);
  expect(await inspection).toEqual({ kind: 'valid', pages: 3 });
});
