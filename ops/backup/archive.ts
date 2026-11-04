import { createHash } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  assertPrivateBackupOutput,
  assertUnlinkedBackupPath,
  hashBackupFile,
  openBackupInput,
  runBackupTool,
} from './tools';

export type BackupArchiveEntry = { name: string; path: string };
export type BackupArchiveFile = { name: string; byteLength: number; sha256: string };
type Member = BackupArchiveFile & { offset: number };
type File = Awaited<ReturnType<typeof open>>;
const permittedName = (name: string) =>
  /^(?:manifest\.json|database\.dump|publication\/current\.json|objects\/[a-f0-9]{64})$/.test(name);
function names(entries: readonly { name: string }[]) {
  const selected = new Set<string>();
  for (const entry of entries) {
    if (!permittedName(entry.name) || selected.has(entry.name))
      throw new Error('Backup archive member refused');
    selected.add(entry.name);
  }
  if (!selected.has('manifest.json') || !selected.has('database.dump'))
    throw new Error('Backup archive is incomplete');
}
async function read(file: File, position: number, size: number) {
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const result = await file.read(buffer, offset, size - offset, position + offset);
    if (!result.bytesRead) throw new Error('Truncated backup archive');
    offset += result.bytesRead;
  }
  return buffer;
}
function text(field: Buffer) {
  const end = field.indexOf(0);
  const bytes = end < 0 ? field : field.subarray(0, end);
  if (
    (end >= 0 && field.subarray(end).some((value) => value !== 0)) ||
    bytes.some((value) => value < 32 || value > 126)
  )
    throw new Error('Invalid backup archive header');
  return bytes.toString('ascii');
}
function octal(field: Buffer) {
  if (field.some((value) => value !== 0 && value !== 32 && (value < 48 || value > 55)))
    throw new Error('Invalid backup archive size or checksum');
  const value = field
    .toString('ascii')
    .replace(/[\0 ]+$/, '')
    .trimStart();
  if (!/^[0-7]+$/.test(value)) throw new Error('Invalid backup archive numeric field');
  const result = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error('Unsafe backup archive numeric field');
  return result;
}
async function inspect(file: File): Promise<Member[]> {
  const info = await file.stat();
  if (!info.isFile() || info.size < 1024 || info.size % 512 !== 0)
    throw new Error('Invalid backup archive length');
  const members: Member[] = [];
  let position = 0;
  while (position < info.size) {
    const header = await read(file, position, 512);
    if (header.every((value) => value === 0)) {
      if (info.size - position < 1024) throw new Error('Incomplete backup archive terminator');
      for (let tail = position; tail < info.size; tail += 65_536) {
        const bytes = await read(file, tail, Math.min(65_536, info.size - tail));
        if (bytes.some((value) => value !== 0))
          throw new Error('Unexpected data after backup archive terminator');
      }
      names(members);
      return members;
    }
    const expected = octal(header.subarray(148, 156));
    const checksum = [...header].reduce(
      (sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value),
      0,
    );
    const name = text(header.subarray(0, 100));
    if (
      checksum !== expected ||
      header.subarray(257, 263).toString('ascii') !== 'ustar\0' ||
      header.subarray(263, 265).toString('ascii') !== '00' ||
      ![0, 48].includes(header[156]) ||
      header.subarray(157, 257).some((value) => value !== 0) ||
      header.subarray(345, 500).some((value) => value !== 0) ||
      !permittedName(name) ||
      members.some((member) => member.name === name)
    )
      throw new Error('Unsafe or unsupported backup archive member');
    const byteLength = octal(header.subarray(124, 136));
    const offset = position + 512;
    const padded = Math.ceil(byteLength / 512) * 512;
    if (!Number.isSafeInteger(offset + padded) || offset + padded > info.size - 1024)
      throw new Error('Truncated backup archive member');
    const hash = createHash('sha256');
    for (let cursor = 0; cursor < byteLength; cursor += 65_536)
      hash.update(await read(file, offset + cursor, Math.min(65_536, byteLength - cursor)));
    const padding = padded - byteLength;
    if (padding && (await read(file, offset + byteLength, padding)).some((value) => value !== 0))
      throw new Error('Nonzero backup archive padding');
    members.push({ name, byteLength, sha256: hash.digest('hex'), offset });
    position = offset + padded;
  }
  throw new Error('Missing backup archive terminator');
}
export async function createBackupArchive(options: {
  entries: readonly BackupArchiveEntry[];
  destination: string;
  tarBinary: string;
}): Promise<{
  path: string;
  byteLength: number;
  sha256: string;
  entries: BackupArchiveFile[];
  toolVersion: string;
}> {
  names(options.entries);
  await assertPrivateBackupOutput(options.destination);
  let root: string | undefined;
  const expected: BackupArchiveFile[] = [];
  for (const entry of options.entries) {
    if (!path.isAbsolute(entry.path))
      throw new Error('Backup archive sources require absolute paths');
    let parent = path.resolve(entry.path);
    for (let index = 0; index < entry.name.split('/').length; index++)
      parent = path.dirname(parent);
    if (
      path.resolve(parent, ...entry.name.split('/')) !== path.resolve(entry.path) ||
      (root !== undefined && root !== parent)
    )
      throw new Error('Backup archive sources require one private staging root');
    root = parent;
    await assertPrivateBackupOutput(entry.path);
    expected.push({ name: entry.name, ...(await hashBackupFile(entry.path)) });
  }
  const version = (
    await runBackupTool({ binary: options.tarBinary, args: ['--version'] })
  ).stdout.trim();
  const bsd = /^bsdtar 3\.8\.9(?:\s|$)/.test(version);
  const gnu = /^tar \(GNU tar\) 1\.35(?:\r?\n|$)/.test(version);
  if (!bsd && !gnu) throw new Error('Backup tar version requires validation');
  let created = false;
  try {
    await runBackupTool({
      binary: options.tarBinary,
      args: [
        '--format=ustar',
        '--no-acls',
        '--no-xattrs',
        ...(bsd ? ['--no-fflags'] : []),
        '--no-recursion',
        '-cf',
        '-',
        '-C',
        root!,
        '--',
        ...options.entries.map((entry) => entry.name),
      ],
      outputFile: options.destination,
    });
    created = true;
    const file = await openBackupInput(options.destination);
    let members: Member[];
    try {
      members = await inspect(file);
    } finally {
      await file.close();
    }
    if (
      members.length !== expected.length ||
      members.some(
        (member, index) =>
          member.name !== expected[index].name ||
          member.byteLength !== expected[index].byteLength ||
          member.sha256 !== expected[index].sha256,
      )
    )
      throw new Error('Backup archive differs from captured input files');
    return {
      path: options.destination,
      ...(await hashBackupFile(options.destination)),
      entries: members.map(({ name, byteLength, sha256 }) => ({ name, byteLength, sha256 })),
      toolVersion: version,
    };
  } catch (error) {
    if (created) await unlink(options.destination);
    throw error;
  }
}
export async function extractValidatedBackupArchive(options: {
  archivePath: string;
  destination: string;
}): Promise<{ directory: string; entries: (BackupArchiveFile & { path: string })[] }> {
  await assertPrivateBackupOutput(options.destination);
  const file = await openBackupInput(options.archivePath);
  try {
    // Validate EVERY header/member/end block before creating the quarantine.
    const members = await inspect(file);
    await assertUnlinkedBackupPath(options.destination);
    await mkdir(options.destination, { mode: 0o700 });
    const entries: (BackupArchiveFile & { path: string })[] = [];
    for (const member of members) {
      const selected = path.join(options.destination, ...member.name.split('/'));
      await mkdir(path.dirname(selected), { recursive: true, mode: 0o700 });
      const output = await open(selected, 'wx', 0o600);
      const hash = createHash('sha256');
      try {
        for (let cursor = 0; cursor < member.byteLength; cursor += 65_536) {
          const bytes = await read(
            file,
            member.offset + cursor,
            Math.min(65_536, member.byteLength - cursor),
          );
          await output.writeFile(bytes);
          hash.update(bytes);
        }
        await output.sync();
      } finally {
        await output.close();
      }
      if (hash.digest('hex') !== member.sha256)
        throw new Error('Backup archive changed after validation');
      entries.push({
        name: member.name,
        path: selected,
        byteLength: member.byteLength,
        sha256: member.sha256,
      });
    }
    return { directory: options.destination, entries };
  } finally {
    await file.close();
  }
}
