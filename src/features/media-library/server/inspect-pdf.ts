import 'server-only';

type PdfInspection =
  | { kind: 'valid'; pages: number }
  | { kind: 'invalid' | 'password-required' | 'cancelled' | 'unavailable' };

export async function inspectPdf(bytes: Uint8Array, signal?: AbortSignal): Promise<PdfInspection> {
  if (signal?.aborted) return { kind: 'cancelled' };
  const captured = Uint8Array.from(bytes);
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (signal?.aborted) return { kind: 'cancelled' };
    const task = getDocument({
      data: captured,
      password: '',
      enableXfa: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    let cancellation: Promise<void> | undefined;
    const cancel = () => {
      cancellation ??= task.destroy();
      // Cleanup errors are awaited below before the upload can finish.
      void cancellation.catch(() => {});
    };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const document = await task.promise;
      return signal?.aborted ? { kind: 'cancelled' } : { kind: 'valid', pages: document.numPages };
    } catch (error) {
      return {
        kind: signal?.aborted
          ? 'cancelled'
          : error instanceof Error && error.name === 'PasswordException'
            ? 'password-required'
            : 'invalid',
      };
    } finally {
      signal?.removeEventListener('abort', cancel);
      await (cancellation ?? task.destroy());
    }
  } catch {
    return { kind: 'unavailable' };
  }
}
