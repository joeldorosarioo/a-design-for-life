import 'server-only';
import type {
  UploadCandidate,
  UploadInput,
  UploadResult,
  UploadType,
} from '../contracts/upload.schema';

// MB is decimal: images <=10,000,000 bytes, PDFs <=5,000,000 bytes.
const IMAGE_BYTES = 10_000_000;
const PDF_BYTES = 5_000_000;
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  Buffer.from(bytes.subarray(start, start + length)).toString('ascii');
function candidateType(bytes: Uint8Array): UploadType | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
    return 'image/webp';
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === 'ftyp') {
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    if (boxSize >= 16 && boxSize <= bytes.length) {
      const brands = [ascii(bytes, 8, 4)];
      for (let offset = 16; offset + 4 <= boxSize; offset += 4)
        brands.push(ascii(bytes, offset, 4));
      if (brands.includes('avif') || brands.includes('avis')) return 'image/avif';
    }
  }
  if (Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from('%PDF-'))) return 'application/pdf';
}
const invalid = (message: string): UploadResult<never> => ({
  ok: false,
  error: { code: 'invalid-input', message },
});
export function preflightUpload(file: UploadInput): UploadResult<UploadCandidate> {
  if (file.bytes.byteLength === 0) return invalid('O arquivo está vazio. Escolha outro arquivo.');
  const type = candidateType(file.bytes);
  const pdfName = /\.pdf$/i.test(file.name);
  const pdfMime = file.declaredType.toLowerCase() === 'application/pdf';
  if (
    (type === 'application/pdf' || pdfName || pdfMime) &&
    (type !== 'application/pdf' || !pdfName || !pdfMime)
  )
    return invalid('Envie um PDF válido com extensão .pdf.');
  if (!type) return invalid('Use JPEG, PNG, WebP, AVIF ou PDF. SVG não é permitido.');
  const maximum = type === 'application/pdf' ? PDF_BYTES : IMAGE_BYTES;
  if (file.bytes.byteLength > maximum)
    return invalid(`O arquivo excede ${maximum.toLocaleString('pt-BR')} bytes.`);
  return { ok: true, value: { ...file, type, byteLength: file.bytes.byteLength } };
}
