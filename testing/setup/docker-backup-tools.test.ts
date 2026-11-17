import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { dockerAgeInvocation } from './docker-backup-tools';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== path.resolve(tmpdir()) ||
      !path.basename(root).startsWith('adfl-docker-age-')
    )
      throw new Error('Invalid Docker transport fixture cleanup target');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'adfl-docker-age-'));
  roots.push(root);
  const source = path.join(root, 'source.age'),
    identity = path.join(root, 'test.agekey');
  await writeFile(source, 'synthetic ciphertext');
  await writeFile(identity, 'synthetic identity');
  return {
    root,
    source,
    identity,
    config: {
      dockerBinary: process.execPath,
      dockerImage: 'sha256:' + 'a'.repeat(64),
      ageBinary: path.join(root, process.platform === 'win32' ? 'age.exe' : 'age'),
    },
  };
}
it('mounts only the explicit input file read-only for real encryption', async () => {
  const { config, source, root } = await fixture();
  const command = await dockerAgeInvocation(config, {
    binary: config.ageBinary,
    args: ['--encrypt', '--recipient', 'age1synthetic', source],
  });
  expect(command?.name).toMatch(/^adfl-test-age-[a-f0-9-]+$/);
  expect(command?.args).toContain(`type=bind,src=${source},dst=/tmp/adfl-input-0,readonly`);
  expect(command?.args.filter((value) => value === '--mount')).toHaveLength(1);
  expect(command?.args).not.toContain(root);
  expect(command?.args).toContain('--read-only');
  expect(command?.args).toContain('none');
  expect(command?.args.slice(-5)).toEqual([
    config.dockerImage,
    '--encrypt',
    '--recipient',
    'age1synthetic',
    '/tmp/adfl-input-0',
  ]);
});
it('mounts the identity and ciphertext separately, never a host output or parent directory', async () => {
  const { config, source, identity } = await fixture();
  const output = path.join(path.dirname(source), 'plaintext');
  const command = await dockerAgeInvocation(config, {
    binary: config.ageBinary,
    args: ['--decrypt', '--identity', identity, source],
    outputFile: output,
  });
  expect(command?.args.filter((value) => value === '--mount')).toHaveLength(2);
  expect(command?.args).toContain(`type=bind,src=${identity},dst=/tmp/adfl-input-0,readonly`);
  expect(command?.args).toContain(`type=bind,src=${source},dst=/tmp/adfl-input-1,readonly`);
  expect(command?.args.join(' ')).not.toContain(output);
});
it('accepts only the immutable built image ID', async () => {
  const { config } = await fixture();
  await expect(
    dockerAgeInvocation(
      { ...config, dockerImage: 'unreviewed:latest' },
      { binary: config.ageBinary, args: ['--version'] },
    ),
  ).rejects.toThrow(/image|configuration/i);
});
it.each([
  { args: ['--output', '/host/output'] },
  { args: ['--decrypt'] },
  { args: ['--encrypt', '--recipient', 'age1synthetic', '/missing', '--output', '/host/output'] },
])('refuses unsupported arguments before native execution', async ({ args }) => {
  const { config } = await fixture();
  await expect(dockerAgeInvocation(config, { binary: config.ageBinary, args })).rejects.toThrow(
    /invocation/i,
  );
});
it('refuses directories and links instead of exposing additional host files', async () => {
  const { config, root } = await fixture();
  const directory = path.join(root, 'directory'),
    linked = path.join(root, 'linked');
  await mkdir(directory);
  await writeFile(path.join(directory, 'source'), 'synthetic');
  await symlink(directory, linked, process.platform === 'win32' ? 'junction' : 'dir');
  for (const input of [directory, path.join(linked, 'source')])
    await expect(
      dockerAgeInvocation(config, {
        binary: config.ageBinary,
        args: ['--encrypt', '--recipient', 'age1synthetic', input],
      }),
    ).rejects.toThrow(/file|linked/i);
});
it('refuses a mount-option delimiter in an input filename', async () => {
  const { config, root } = await fixture();
  const file = path.join(root, 'input,readonly');
  await writeFile(file, 'synthetic');
  await expect(
    dockerAgeInvocation(config, {
      binary: config.ageBinary,
      args: ['--encrypt', '--recipient', 'age1synthetic', file],
    }),
  ).rejects.toThrow(/mount|file/i);
});
it('leaves ordinary host tool invocations unchanged', async () => {
  const { config } = await fixture();
  expect(
    await dockerAgeInvocation(config, { binary: process.execPath, args: ['--version'] }),
  ).toBeUndefined();
});
