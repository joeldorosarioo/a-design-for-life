import 'server-only';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { pdfInspectionSchema, type PdfInspection } from '../contracts/pdf-inspection.schema';
import { checkPdfStreams } from './check-pdf-streams';

const require = createRequire(import.meta.url);
// A dedicated Node worker owns the parser and all decoded page resources. Embedded
// actions remain document data: no viewer, scripting manager or action evaluation.
const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  let task;
  let result;
  try {
    const { getDocument } = await import(workerData.parser);
    task = getDocument({ data: workerData.bytes, password: '', stopAtErrors: true,
      enableXfa: false, disableFontFace: true, useSystemFonts: false,
      useWorkerFetch: false, verbosity: 0,
      cMapUrl: workerData.resources + '/cmaps/',
      standardFontDataUrl: workerData.resources + '/standard_fonts/',
      wasmUrl: workerData.resources + '/wasm/' });
    try {
      const pdf = await task.promise;
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        try { await page.getOperatorList(); }
        finally { page.cleanup(); }
      }
      result = { kind: 'valid', pages: pdf.numPages };
    } catch (error) {
      result = { kind: error?.name === 'PasswordException' ? 'password-required' : 'invalid' };
    }
  } catch { result = { kind: 'unavailable' }; }
  finally { if (task) await task.destroy(); }
  parentPort.postMessage(result);
})();`;

async function inspectPdfPages(bytes: Uint8Array, signal?: AbortSignal): Promise<PdfInspection> {
  if (signal?.aborted) return { kind: 'cancelled' };
  const parserPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const resources = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const captured = Uint8Array.from(bytes);
  return new Promise((resolve) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: {
        bytes: captured,
        parser: pathToFileURL(parserPath).href,
        resources,
      },
      transferList: [captured.buffer],
    });
    let settled = false;
    const finish = async (result: PdfInspection) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      await worker.terminate();
      resolve(result);
    };
    const abort = () => {
      void finish({ kind: 'cancelled' });
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    worker.once('message', (message: unknown) => {
      const parsed = pdfInspectionSchema.safeParse(message);
      void finish(parsed.success ? parsed.data : { kind: 'unavailable' });
    });
    worker.once('error', () => {
      void finish({ kind: 'unavailable' });
    });
    worker.once('exit', () => {
      void finish({ kind: 'unavailable' });
    });
  });
}

export async function inspectPdf(
  bytes: Uint8Array,
  options: { checkerBinary: string; signal?: AbortSignal },
): Promise<PdfInspection> {
  const captured = Uint8Array.from(bytes);
  const pages = await inspectPdfPages(captured, options.signal);
  if (pages.kind !== 'valid') return pages;
  const streams = await checkPdfStreams(captured, options.checkerBinary, options.signal);
  return streams === 'valid'
    ? pages
    : streams === 'warnings'
      ? { kind: 'warnings', pages: pages.pages }
      : { kind: streams };
}
