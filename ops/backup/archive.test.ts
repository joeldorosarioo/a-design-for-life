import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import * as backupTools from './tools';
import { createBackupArchive, extractValidatedBackupArchive } from './archive';
import { decryptBackupArchive, encryptBackupArchive } from './age';
const roots: string[] = [];
async function scratch() {
  const base = path.resolve('.work/backup-tool-tests');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, 'archive-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== path.resolve('.work/backup-tool-tests'))
      throw new Error('Unsafe archive fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
function tar(
  entries: { name: string; bytes: Buffer; type?: string; link?: string; prefix?: string }[],
) {
  return Buffer.concat([
    ...entries.flatMap((entry) => {
      const header = Buffer.alloc(512);
      header.write(entry.name, 0, 100, 'ascii');
      header.write('0000600\0', 100, 'ascii');
      header.write('0000000\0', 108, 'ascii');
      header.write('0000000\0', 116, 'ascii');
      header.write(entry.bytes.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
      header.write('00000000000\0', 136, 'ascii');
      header.fill(32, 148, 156);
      header.write(entry.type ?? '0', 156, 'ascii');
      if (entry.link) header.write(entry.link, 157, 100, 'ascii');
      header.write('ustar\0', 257, 'ascii');
      header.write('00', 263, 'ascii');
      if (entry.prefix) header.write(entry.prefix, 345, 155, 'ascii');
      const checksum = [...header].reduce((sum, value) => sum + value, 0);
      header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
      return [header, entry.bytes, Buffer.alloc((512 - (entry.bytes.length % 512)) % 512)];
    }),
    Buffer.alloc(1024),
  ]);
}
const valid = () => [
  { name: 'manifest.json', bytes: Buffer.from('{}') },
  { name: 'database.dump', bytes: Buffer.from('native custom dump synthetic unit bytes') },
];
it('validates and extracts complete regular USTAR files before returning a quarantine', async () => {
  const root = await scratch(),
    archive = path.join(root, 'set.tar'),
    destination = path.join(root, 'quarantine');
  await writeFile(archive, tar(valid()));
  const result = await extractValidatedBackupArchive({ archivePath: archive, destination });
  expect(result.entries.map((entry) => entry.name)).toEqual(['manifest.json', 'database.dump']);
  expect(await readFile(path.join(destination, 'database.dump'), 'utf8')).toBe(
    'native custom dump synthetic unit bytes',
  );
  expect(result.entries[0].sha256).toBe(
    '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
  );
});
it.each([
  ['traversal', { name: '../escaped', bytes: Buffer.from('unsafe') }],
  ['absolute path', { name: '/absolute', bytes: Buffer.from('unsafe') }],
  ['private identity', { name: 'identity.txt', bytes: Buffer.from('unsafe') }],
  [
    'symbolic link',
    { name: 'objects/' + 'a'.repeat(64), bytes: Buffer.alloc(0), type: '2', link: '../identity' },
  ],
  [
    'hard link',
    { name: 'objects/' + 'a'.repeat(64), bytes: Buffer.alloc(0), type: '1', link: 'database.dump' },
  ],
  ['directory', { name: 'objects/' + 'a'.repeat(64), bytes: Buffer.alloc(0), type: '5' }],
  [
    'PAX metadata',
    { name: 'objects/' + 'a'.repeat(64), bytes: Buffer.from('path=../unsafe'), type: 'x' },
  ],
  [
    'GNU long name',
    { name: 'objects/' + 'a'.repeat(64), bytes: Buffer.from('../unsafe'), type: 'L' },
  ],
  [
    'unexpected prefix',
    { name: 'objects/' + 'a'.repeat(64), bytes: Buffer.from('unsafe'), prefix: 'elsewhere' },
  ],
  ['duplicate member', { name: 'manifest.json', bytes: Buffer.from('other manifest') }],
])('refuses %s before creating any extraction destination', async (_name, entry) => {
  const root = await scratch(),
    archive = path.join(root, 'set.tar'),
    destination = path.join(root, 'quarantine');
  await writeFile(archive, tar([...valid(), entry]));
  await expect(
    extractValidatedBackupArchive({ archivePath: archive, destination }),
  ).rejects.toThrow();
  await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
});
it.each(['checksum', 'padding', 'trailing'] as const)(
  'refuses invalid %s before extraction effects',
  async (failure) => {
    const root = await scratch(),
      archive = path.join(root, 'set.tar'),
      destination = path.join(root, 'quarantine');
    let bytes = tar(valid());
    if (failure === 'checksum') bytes[148] = 57;
    if (failure === 'padding') bytes[520] = 1;
    if (failure === 'trailing') bytes = Buffer.concat([bytes, Buffer.alloc(512, 1)]);
    await writeFile(archive, bytes);
    await expect(
      extractValidatedBackupArchive({ archivePath: archive, destination }),
    ).rejects.toThrow();
    await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);
it('refuses an internal NUL in a numeric USTAR field even when the checksum matches', async () => {
  const root = await scratch(),
    archive = path.join(root, 'set.tar'),
    destination = path.join(root, 'quarantine');
  const bytes = tar(valid());
  bytes[124] = 0;
  bytes.fill(32, 148, 156);
  const checksum = [...bytes.subarray(0, 512)].reduce((sum, value) => sum + value, 0);
  bytes.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  await writeFile(archive, bytes);
  await expect(
    extractValidatedBackupArchive({ archivePath: archive, destination }),
  ).rejects.toThrow();
  await expect(readdir(destination)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('refuses to reuse an existing quarantine and preserves its bytes', async () => {
  const root = await scratch(),
    archive = path.join(root, 'set.tar'),
    destination = path.join(root, 'quarantine');
  await writeFile(archive, tar(valid()));
  await mkdir(destination);
  await writeFile(path.join(destination, 'sentinel'), 'existing');
  await expect(
    extractValidatedBackupArchive({ archivePath: archive, destination }),
  ).rejects.toThrow();
  expect(await readFile(path.join(destination, 'sentinel'), 'utf8')).toBe('existing');
});
it('does not create an archive for a private identity or other forbidden entry name', async () => {
  const root = await scratch(),
    file = path.join(root, 'identity.txt');
  await writeFile(file, 'private synthetic identity');
  const destination = path.join(root, 'set.tar');
  await expect(
    createBackupArchive({
      entries: [{ name: 'identity.txt', path: file }],
      destination,
      tarBinary: process.execPath,
    }),
  ).rejects.toThrow();
  await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
});
it.skipIf(!process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG)(
  'creates a real bsdtar USTAR archive and verifies all streamed file hashes',
  async () => {
    const fixture = JSON.parse(
      await readFile(process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG!, 'utf8'),
    ) as { tarBinary: string; ageBinary: string; recipient: string; identityPath: string };
    const root = await scratch(),
      source = path.join(root, 'source');
    await mkdir(source);
    const entries = [];
    for (const file of valid()) {
      const selected = path.join(source, file.name);
      await writeFile(selected, file.bytes);
      entries.push({ name: file.name, path: selected });
    }
    await mkdir(path.join(source, 'objects'));
    const objectName = 'objects/' + 'a'.repeat(64);
    const objectPath = path.join(source, objectName);
    await writeFile(objectPath, Buffer.alloc(200_000, 7));
    entries.push({ name: objectName, path: objectPath });
    const result = await createBackupArchive({
      entries,
      destination: path.join(root, 'set.tar'),
      tarBinary: fixture.tarBinary,
    });
    expect(result.toolVersion).toMatch(
      /^(?:bsdtar 3\.8\.9(?:\s|$)|tar \(GNU tar\) 1\.35(?:\r?\n|$))/,
    );
    expect(result.entries.map((entry) => [entry.name, entry.byteLength])).toEqual([
      ['manifest.json', 2],
      ['database.dump', 39],
      [objectName, 200_000],
    ]);
    expect(result.sha256).toBe(
      createHash('sha256')
        .update(await readFile(result.path))
        .digest('hex'),
    );
    const encrypted = await encryptBackupArchive({
      sourcePath: result.path,
      destination: path.join(root, 'payload.age'),
      recipient: fixture.recipient,
      ageBinary: fixture.ageBinary,
    });
    const decrypted = await decryptBackupArchive({
      sourcePath: encrypted.path,
      destination: path.join(root, 'decrypted.tar'),
      identityPath: fixture.identityPath,
      ageBinary: fixture.ageBinary,
    });
    const extracted = await extractValidatedBackupArchive({
      archivePath: decrypted.path,
      destination: path.join(root, 'quarantine'),
    });
    expect(extracted.entries).toHaveLength(3);
    expect(await readFile(path.join(extracted.directory, objectName))).toEqual(
      Buffer.alloc(200_000, 7),
    );
  },
);

it('uses the explicit GNU tar 1.35 command while validating actual produced archive bytes', async () => {
  const root = await scratch(),
    source = path.join(root, 'source');
  await mkdir(source);
  const entries = [];
  for (const entry of valid()) {
    const selected = path.join(source, entry.name);
    await writeFile(selected, entry.bytes);
    entries.push({ name: entry.name, path: selected });
  }
  const destination = path.join(root, 'gnu.tar');
  vi.spyOn(backupTools, 'runBackupTool').mockImplementation(async (options) => {
    if (options.binary !== process.execPath) throw new Error('Unexpected process binary');
    if (options.args.length === 1 && options.args[0] === '--version')
      return {
        stdout: 'tar (GNU tar) 1.35\nCopyright (C) Free Software Foundation\n',
        exitCode: 0,
      };
    expect(options.args).toEqual([
      '--format=ustar',
      '--no-acls',
      '--no-xattrs',
      '--no-recursion',
      '-cf',
      '-',
      '-C',
      source,
      '--',
      'manifest.json',
      'database.dump',
    ]);
    expect(options.outputFile).toBe(destination);
    await writeFile(destination, tar(valid()), { flag: 'wx' });
    return { stdout: '', exitCode: 0 };
  });
  await expect(
    createBackupArchive({ entries, destination, tarBinary: process.execPath }),
  ).resolves.toMatchObject({
    toolVersion: 'tar (GNU tar) 1.35\nCopyright (C) Free Software Foundation',
    entries: [
      { name: 'manifest.json', byteLength: 2 },
      { name: 'database.dump', byteLength: 39 },
    ],
  });
  const restored = await extractValidatedBackupArchive({
    archivePath: destination,
    destination: path.join(root, 'quarantine'),
  });
  expect(await readFile(path.join(restored.directory, 'database.dump'), 'utf8')).toBe(
    'native custom dump synthetic unit bytes',
  );
});
it.each(['tar (GNU tar) 1.34', 'tar (GNU tar) 1.35.1', 'bsdtar 3.8.9.1'])(
  'refuses unvalidated tar version %s before creation effects',
  async (version) => {
    const root = await scratch(),
      source = path.join(root, 'source');
    await mkdir(source);
    const entries = [];
    for (const entry of valid()) {
      const selected = path.join(source, entry.name);
      await writeFile(selected, entry.bytes);
      entries.push({ name: entry.name, path: selected });
    }
    const destination = path.join(root, 'unvalidated.tar'),
      effect = path.join(root, 'invoked');
    vi.spyOn(backupTools, 'runBackupTool').mockImplementation(async (options) => {
      if (options.args.length === 1 && options.args[0] === '--version')
        return { stdout: version, exitCode: 0 };
      await writeFile(effect, 'unexpected archive creation');
      await writeFile(destination, tar(valid()), { flag: 'wx' });
      return { stdout: '', exitCode: 0 };
    });
    await expect(
      createBackupArchive({ entries, destination, tarBinary: process.execPath }),
    ).rejects.toThrow();
    await expect(readFile(effect)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(destination)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);
