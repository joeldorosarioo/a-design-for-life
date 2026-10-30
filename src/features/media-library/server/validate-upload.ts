import 'server-only';
import sharp from 'sharp';
import type { UploadInput, UploadResult } from '../contracts/upload.schema';
import type { ValidatedImage, ValidatedUpload } from '../contracts/validated-upload.schema';
import { preflightUpload } from './preflight-upload';
import { inspectPdf } from './inspect-pdf';

function unsupportedAnimation(bytes: Uint8Array, type: string) {
  const ascii = (offset: number, length: number) =>
    Buffer.from(bytes.subarray(offset, offset + length)).toString('ascii');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png')
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (ascii(offset + 4, 4) === 'acTL')
        return 'APNG não é permitido. Use PNG estático ou WebP animado.';
      if (length > bytes.length - offset - 12) break;
      offset += length + 12;
    }
  if (type === 'image/avif' && bytes.length >= 16) {
    const end = Math.min(view.getUint32(0), bytes.length);
    for (let offset = 8; offset + 4 <= end; offset += 4)
      if (offset !== 12 && ascii(offset, 4) === 'avis')
        return 'AVIF animado não é permitido. Use AVIF estático ou WebP animado.';
  }
}

const invalid = (message: string): UploadResult<never> => ({
  ok: false,
  error: { code: 'invalid-input', message },
});

export async function validateUpload(
  file: UploadInput,
  options: { checkerBinary: string; signal?: AbortSignal },
): Promise<UploadResult<ValidatedUpload>> {
  const candidate = preflightUpload(file);
  if (!candidate.ok) return candidate;
  const bytes = Uint8Array.from(file.bytes);
  const { type, byteLength } = candidate.value;
  const unsupported = unsupportedAnimation(bytes, type);
  if (unsupported) return invalid(unsupported);
  if (type === 'application/pdf') {
    const pdf = await inspectPdf(bytes, options);
    if (pdf.kind === 'password-required')
      return invalid('PDF com senha de abertura não é permitido. Envie um PDF que abra sem senha.');
    if (pdf.kind === 'valid')
      return { ok: true, value: { kind: 'pdf', type, bytes, byteLength, pages: pdf.pages } };
    if (pdf.kind === 'invalid') return invalid('O PDF não pôde ser validado. Verifique o arquivo.');
    return {
      ok: false,
      error: {
        code: 'unavailable',
        message:
          'A verificação completa do PDF está temporariamente indisponível. Nenhum arquivo foi salvo.',
      },
    };
  }
  try {
    const image = sharp(bytes, { animated: true });
    const metadata = await image.metadata();
    const expected =
      type === 'image/jpeg'
        ? 'jpeg'
        : type === 'image/png'
          ? 'png'
          : type === 'image/webp'
            ? 'webp'
            : 'heif';
    if (
      metadata.format !== expected ||
      (type === 'image/avif' &&
        (metadata.compression !== 'av1' || metadata.mediaType !== 'image/avif'))
    )
      throw new Error('Unexpected image decoder');
    const pages = metadata.pages ?? 1;
    if (pages > 1 && type !== 'image/webp')
      return invalid('AVIF animado não é permitido. Use AVIF estático ou WebP animado.');
    // Stats consumes every decoded page, including later frames, without flattening the original.
    await image.stats();
    let width = metadata.autoOrient?.width ?? metadata.width;
    let height = metadata.autoOrient?.height ?? metadata.height;
    let animation: ValidatedImage['animation'];
    if (pages > 1) {
      if (
        !metadata.width ||
        !metadata.pageHeight ||
        metadata.delay?.length !== pages ||
        metadata.loop === undefined
      )
        throw new Error('Missing animation dimensions or timing');
      const transposed =
        metadata.orientation !== undefined &&
        metadata.orientation >= 5 &&
        metadata.orientation <= 8;
      width = transposed ? metadata.pageHeight : metadata.width;
      height = transposed ? metadata.width : metadata.pageHeight;
      animation = { pages, delay: [...metadata.delay], loop: metadata.loop };
    }
    if (!width || !height) throw new Error('Missing dimensions');
    return {
      ok: true,
      value: {
        kind: 'image',
        type,
        bytes,
        byteLength,
        width,
        height,
        ...(animation ? { animation } : {}),
      },
    };
  } catch {
    return invalid(
      'A imagem está incompleta, danificada ou não pôde ser decodificada com segurança.',
    );
  }
}
