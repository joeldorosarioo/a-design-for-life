import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { vi } from 'vitest';
import { dockerTestContainerOptions } from './configure-backup-tools.mjs';
import { assertUnlinkedBackupPath, type BackupToolOptions } from '../../ops/backup/tools';

export type DockerBackupTools = { dockerBinary: string; dockerImage: string; ageBinary: string };
type Runner = typeof import('../../ops/backup/tools').runBackupTool;

vi.mock('../../ops/backup/tools', async (original) => {
  const actual = await original<typeof import('../../ops/backup/tools')>();
  return {
    ...actual,
    runBackupTool: (options: BackupToolOptions) =>
      runDockerBackupTool(options, actual.runBackupTool),
  };
});

export async function dockerAgeInvocation(
  config: DockerBackupTools,
  options: BackupToolOptions,
): Promise<{ name: string; args: string[] } | undefined> {
  const keygen = path.join(
    path.dirname(config.ageBinary),
    'age-keygen' + path.extname(config.ageBinary),
  );
  if (![config.ageBinary, keygen].includes(options.binary)) return;
  if (!path.isAbsolute(config.dockerBinary) || !/^sha256:[a-f0-9]{64}$/.test(config.dockerImage))
    throw new Error('Invalid Docker backup test image configuration');
  const tool = options.binary === keygen ? 'age-keygen' : 'age';
  const args = [...options.args],
    mounts: string[] = [];
  async function input(index: number) {
    const file = args[index];
    if (!path.isAbsolute(file) || /[,\r\n\0]/.test(file))
      throw new Error('Unsupported Docker backup input file mount');
    await assertUnlinkedBackupPath(file);
    const info = await lstat(file);
    if (!info.isFile() || info.nlink !== 1)
      throw new Error('Regular unlinked test input file required');
    const target = '/tmp/adfl-input-' + mounts.length / 2;
    mounts.push('--mount', 'type=bind,src=' + file + ',dst=' + target + ',readonly');
    args[index] = target;
  }
  if (args.length === 1 && args[0] === '--version') {
    // Version checks use the same immutable image as encryption and recovery.
  } else if (tool === 'age-keygen' && args.length === 2 && args[0] === '-y') await input(1);
  else if (
    tool === 'age' &&
    args.length === 4 &&
    args[0] === '--encrypt' &&
    args[1] === '--recipient'
  )
    await input(3);
  else if (
    tool === 'age' &&
    args.length === 4 &&
    args[0] === '--decrypt' &&
    args[1] === '--identity'
  ) {
    await input(2);
    await input(3);
  } else throw new Error('Unsupported Docker backup test invocation');
  const name = 'adfl-test-age-' + randomUUID();
  return {
    name,
    args: [
      'create',
      '--name',
      name,
      '--interactive',
      '--pull=never',
      ...dockerTestContainerOptions(),
      ...mounts,
      '--entrypoint',
      '/tmp/age/' + tool,
      config.dockerImage,
      ...args,
    ],
  };
}
async function runDockerBackupTool(options: BackupToolOptions, original: Runner) {
  const fixture = process.env.ADFL_TEST_BACKUP_TOOLS_CONFIG;
  if (!fixture || !/^age(?:-keygen)?(?:\.exe)?$/.test(path.basename(options.binary)))
    return original(options);
  const config = JSON.parse(await readFile(fixture, 'utf8')) as DockerBackupTools;
  const command = await dockerAgeInvocation(config, options);
  if (!command) return original(options);
  try {
    const created = spawnSync(config.dockerBinary, command.args, {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 30_000,
    });
    if (created.error || created.status !== 0)
      throw new Error('Docker backup test container could not be created');
    return await original({
      ...options,
      binary: config.dockerBinary,
      args: ['start', '--attach', '--interactive', command.name],
    });
  } finally {
    const removed = spawnSync(config.dockerBinary, ['rm', '--force', command.name], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    });
    if (removed.error || (removed.status !== 0 && !/No such container/i.test(removed.stderr)))
      throw new Error('Docker backup test container cleanup failed');
  }
}
