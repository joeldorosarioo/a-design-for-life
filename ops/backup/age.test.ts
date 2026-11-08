import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptBackupArchive, encryptBackupArchive } from './age';
import { runBackupTool } from './tools';
const roots: string[] = [];
async function scratch() {
  const base = path.resolve('.work/backup-tool-tests');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, 'age-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve('.work/backup-tool-tests'))
      throw new Error('Unsafe age fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
it('rejects a secret identity or recipient file path before invoking a binary', async () => {
  for (const recipient of [
    'AGE-SECRET-KEY-SYNTHETIC',
    'C:/private/identity.txt',
    'age1recipient\n--identity=secret',
  ]) {
    await expect(
      encryptBackupArchive({
        sourcePath: 'source',
        destination: 'destination',
        recipient,
        ageBinary: process.execPath,
      }),
    ).rejects.toThrow();
  }
});
describe.skipIf(!process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG)('real age1.3.2 local proof', () => {
  async function fixture() {
    return JSON.parse(await readFile(process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG!, 'utf8')) as {
      identityPath: string;
      wrongIdentityPath: string;
      recipient: string;
      ageBinary: string;
    };
  }
  it('encrypts with only a public recipient and decrypts with the separate private identity', async () => {
    const config = await fixture(),
      root = await scratch(),
      source = path.join(root, 'archive.tar'),
      ciphertext = path.join(root, 'payload.age'),
      restored = path.join(root, 'restored.tar');
    const bytes = Buffer.from('synthetic private dump and media marker');
    await writeFile(source, bytes);
    const encrypted = await encryptBackupArchive({
      sourcePath: source,
      destination: ciphertext,
      recipient: config.recipient,
      ageBinary: config.ageBinary,
    });
    const cipher = await readFile(ciphertext);
    expect(cipher.includes(bytes)).toBe(false);
    expect(cipher.subarray(0, 22).toString()).toBe('age-encryption.org/v1\n');
    expect(encrypted.sha256).toBe(createHash('sha256').update(cipher).digest('hex'));
    expect(encrypted.toolVersion).toBe('v1.3.2');
    await decryptBackupArchive({
      sourcePath: ciphertext,
      destination: restored,
      identityPath: config.identityPath,
      ageBinary: config.ageBinary,
    });
    expect(await readFile(restored)).toEqual(bytes);
  });
  it('rejects adulterated ciphertext and never publishes plaintext destination', async () => {
    const config = await fixture(),
      root = await scratch(),
      source = path.join(root, 'archive.tar'),
      ciphertext = path.join(root, 'payload.age'),
      restored = path.join(root, 'restored.tar');
    await writeFile(source, 'synthetic plaintext');
    await encryptBackupArchive({
      sourcePath: source,
      destination: ciphertext,
      recipient: config.recipient,
      ageBinary: config.ageBinary,
    });
    const bytes = await readFile(ciphertext);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(ciphertext, bytes);
    await expect(
      decryptBackupArchive({
        sourcePath: ciphertext,
        destination: restored,
        identityPath: config.identityPath,
        ageBinary: config.ageBinary,
      }),
    ).rejects.toThrow();
    await expect(readFile(restored)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects an invalid identity without leaking its contents or publishing plaintext', async () => {
    const config = await fixture(),
      root = await scratch(),
      source = path.join(root, 'archive.tar'),
      ciphertext = path.join(root, 'payload.age'),
      restored = path.join(root, 'restored.tar'),
      wrong = path.join(root, 'wrong-identity.txt');
    await writeFile(source, 'synthetic plaintext');
    await writeFile(wrong, 'AGE-SECRET-KEY-SYNTHETIC-INVALID');
    await encryptBackupArchive({
      sourcePath: source,
      destination: ciphertext,
      recipient: config.recipient,
      ageBinary: config.ageBinary,
    });
    const failure = await decryptBackupArchive({
      sourcePath: ciphertext,
      destination: restored,
      identityPath: wrong,
      ageBinary: config.ageBinary,
    }).then(
      () => null,
      (error) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain('AGE-SECRET');
    await expect(readFile(restored)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('rejects a different valid upstream test identity without publishing plaintext', async () => {
    const config = await fixture(),
      root = await scratch(),
      source = path.join(root, 'archive.tar'),
      ciphertext = path.join(root, 'payload.age'),
      restored = path.join(root, 'restored.tar');
    expect(typeof config.wrongIdentityPath).toBe('string');
    const keygen = path.join(
      path.dirname(config.ageBinary),
      process.platform === 'win32' ? 'age-keygen.exe' : 'age-keygen',
    );
    const wrongRecipient = (
      await runBackupTool({ binary: keygen, args: ['-y', config.wrongIdentityPath] })
    ).stdout.trim();
    expect(wrongRecipient).toMatch(/^age1/);
    expect(wrongRecipient).not.toBe(config.recipient);
    await writeFile(source, 'synthetic private plaintext');
    await encryptBackupArchive({
      sourcePath: source,
      destination: ciphertext,
      recipient: config.recipient,
      ageBinary: config.ageBinary,
    });
    await expect(
      decryptBackupArchive({
        sourcePath: ciphertext,
        destination: restored,
        identityPath: config.wrongIdentityPath,
        ageBinary: config.ageBinary,
      }),
    ).rejects.toThrow();
    await expect(readFile(restored)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('refuses a private identity option even with otherwise valid encryption inputs', async () => {
    const config = await fixture(),
      root = await scratch(),
      source = path.join(root, 'archive.tar'),
      destination = path.join(root, 'payload.age');
    await writeFile(source, 'synthetic plaintext');
    const options = {
      sourcePath: source,
      destination,
      recipient: config.recipient,
      ageBinary: config.ageBinary,
      identityPath: config.identityPath,
    };
    await expect(encryptBackupArchive(options)).rejects.toThrow();
    await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
