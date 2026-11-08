import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function mediaCheckerFixturePath() {
  return path.resolve(
    `.toolchain/qpdf-12.4.2-${process.platform}-${process.arch}/bin/${process.platform === 'win32' ? 'qpdf.exe' : 'qpdf'}`,
  );
}
export async function encryptedPdfUploadFixture(password: string) {
  const parent = path.resolve('.work');
  const directory = await mkdtemp(path.join(parent, 'encrypted-media-fixture-'));
  try {
    const input = path.join(directory, 'input.pdf');
    const output = path.join(directory, 'encrypted.pdf');
    await writeFile(input, pdfUploadFixture(), { mode: 0o600 });
    execFileSync(
      mediaCheckerFixturePath(),
      ['--encrypt', password, 'synthetic-owner-password', '256', '--', input, output],
      { stdio: 'ignore', windowsHide: true },
    );
    return new Uint8Array(await readFile(output));
  } finally {
    if (
      path.dirname(path.resolve(directory)) !== parent ||
      !path.basename(directory).startsWith('encrypted-media-fixture-')
    )
      throw new Error('Invalid encrypted fixture cleanup target');
    await rm(directory, { recursive: true, force: true });
  }
}
export function pdfUploadFixture(
  options: { middleInvalid?: boolean; brokenStream?: boolean } = {},
) {
  const stream = options.brokenStream ? 'not a deflate stream' : 'q 0 0 10 10 re f Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 6 0 R >>',
    options.middleInvalid
      ? 'false'
      : '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 6 0 R >>',
    `<< /Length ${stream.length}${options.brokenStream ? ' /Filter /FlateDecode' : ''} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
