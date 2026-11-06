import path from 'node:path';
import { hashBackupFile, openBackupInput, runBackupTool } from './tools';
type EncryptedArtifact = { path: string; byteLength: number; sha256: string; toolVersion: string };
async function version(binary: string) {
  const actual = (await runBackupTool({ binary, args: ['--version'] })).stdout.trim();
  if (actual !== 'v1.3.2') throw new Error('Backup age version requires validation');
  return actual;
}
function closed(input: object, fields: string[]) {
  if (Object.keys(input).some((key) => !fields.includes(key)))
    throw new Error('Unsupported backup encryption configuration');
}
export async function encryptBackupArchive(options: {
  sourcePath: string;
  destination: string;
  recipient: string;
  ageBinary: string;
}): Promise<EncryptedArtifact> {
  closed(options, ['sourcePath', 'destination', 'recipient', 'ageBinary']);
  if (
    typeof options.recipient !== 'string' ||
    !/^age1(?:pq1)?[023456789acdefghjklmnpqrstuvwxyz]{20,2048}$/.test(options.recipient)
  )
    throw new Error('Backup encryption requires a native public recipient');
  const source = await openBackupInput(options.sourcePath);
  await source.close();
  const toolVersion = await version(options.ageBinary);
  await runBackupTool({
    binary: options.ageBinary,
    args: ['--encrypt', '--recipient', options.recipient, options.sourcePath],
    outputFile: options.destination,
  });
  return { path: options.destination, ...(await hashBackupFile(options.destination)), toolVersion };
}
export async function decryptBackupArchive(options: {
  sourcePath: string;
  destination: string;
  identityPath: string;
  ageBinary: string;
}): Promise<EncryptedArtifact> {
  closed(options, ['sourcePath', 'destination', 'identityPath', 'ageBinary']);
  if (
    [options.sourcePath, options.destination].some(
      (selected) => path.resolve(selected) === path.resolve(options.identityPath),
    )
  )
    throw new Error('Recovery identity must remain separate');
  const identity = await openBackupInput(options.identityPath);
  await identity.close();
  const source = await openBackupInput(options.sourcePath);
  await source.close();
  const toolVersion = await version(options.ageBinary);
  await runBackupTool({
    binary: options.ageBinary,
    args: ['--decrypt', '--identity', options.identityPath, options.sourcePath],
    outputFile: options.destination,
  });
  return { path: options.destination, ...(await hashBackupFile(options.destination)), toolVersion };
}
