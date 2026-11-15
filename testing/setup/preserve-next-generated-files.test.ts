import { lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { preserveNextGeneratedFiles } from './preserve-next-generated-files';

const distDir = '.work/next-tests/11111111-1111-4111-8111-111111111111';
const envBefore =
  '/// <reference types="next" />\nimport "./.work/next-build/types/routes.d.ts";\nimport "./.work/next-build/types/root-params.d.ts";\n';
const configBefore =
  '{\n  "compilerOptions": {"strict": true},\n  "include": ["next-env.d.ts", "**/*.ts"],\n  "exclude": [".work"]\n}\n';
async function workspace(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), 'adfl-next-source-'));
  try {
    await writeFile(path.join(root, 'next-env.d.ts'), envBefore);
    await writeFile(path.join(root, 'tsconfig.json'), configBefore);
    await run(root);
  } finally {
    if (path.dirname(root) !== tmpdir() || !path.basename(root).startsWith('adfl-next-source-'))
      throw new Error('Unsafe scratch cleanup');
    await rm(root, { recursive: true });
  }
}
async function emulateNext(root: string) {
  const config = JSON.parse(configBefore);
  config.include.push(`${distDir}/types/**/*.ts`, `${distDir}/dev/types/**/*.ts`);
  await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify(config, null, 2) + '\n');
  await writeFile(
    path.join(root, 'next-env.d.ts'),
    envBefore.replaceAll('./.work/next-build/', `./${distDir}/`),
  );
}
it('restores original bytes after the known Next type-path mutation and keeps a checkpoint outside the build', async () => {
  await workspace(async (root) => {
    const saved = await preserveNextGeneratedFiles({ root, distDir });
    const snapshot = JSON.parse(await readFile(saved.checkpoint, 'utf8'));
    expect(snapshot.files.map((file: { name: string }) => file.name)).toEqual([
      'next-env.d.ts',
      'tsconfig.json',
    ]);
    expect(Buffer.from(snapshot.files[1].base64, 'base64').toString()).toBe(configBefore);
    expect(
      saved.checkpoint.startsWith(path.join(root, '.work', 'next-source-checkpoints') + path.sep),
    ).toBe(true);
    await emulateNext(root);
    expect(await saved.restore()).toBe('restored');
    expect(await readFile(path.join(root, 'tsconfig.json'), 'utf8')).toBe(configBefore);
    expect(await readFile(path.join(root, 'next-env.d.ts'), 'utf8')).toBe(envBefore);
    expect(await readFile(saved.checkpoint, 'utf8')).toContain('base64');
  });
});
it('leaves already unchanged files untouched', async () => {
  await workspace(async (root) => {
    const saved = await preserveNextGeneratedFiles({ root, distDir });
    expect(await saved.restore()).toBe('unchanged');
    expect(await readFile(path.join(root, 'tsconfig.json'), 'utf8')).toBe(configBefore);
  });
});
it.each(['compiler option', 'type declaration'])(
  'refuses a concurrent %s edit without restoring either file',
  async (kind) => {
    await workspace(async (root) => {
      const saved = await preserveNextGeneratedFiles({ root, distDir });
      await emulateNext(root);
      if (kind === 'compiler option') {
        const config = JSON.parse(await readFile(path.join(root, 'tsconfig.json'), 'utf8'));
        config.compilerOptions.customUserOption = true;
        await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify(config));
      } else {
        await writeFile(
          path.join(root, 'next-env.d.ts'),
          '// user edit\n' + (await readFile(path.join(root, 'next-env.d.ts'), 'utf8')),
        );
      }
      const current = await Promise.all(
        ['next-env.d.ts', 'tsconfig.json'].map((file) => readFile(path.join(root, file), 'utf8')),
      );
      await expect(saved.restore()).rejects.toThrow('changed unexpectedly');
      expect(
        await Promise.all(
          ['next-env.d.ts', 'tsconfig.json'].map((file) => readFile(path.join(root, file), 'utf8')),
        ),
      ).toEqual(current);
    });
  },
);
it('refuses a public output namespace before changing source files', async () => {
  await workspace(async (root) => {
    await expect(preserveNextGeneratedFiles({ root, distDir: 'public/build' })).rejects.toThrow();
    expect(await readFile(path.join(root, 'tsconfig.json'), 'utf8')).toBe(configBefore);
  });
});

it('removes only its reserved test build after restoring sources and leaves internal link targets intact', async () => {
  await workspace(async (root) => {
    const saved = await preserveNextGeneratedFiles({ root, distDir });
    expect(saved).toHaveProperty('reserveTestBuild', expect.any(Function));
    const cleanup = await saved.reserveTestBuild();
    const directory = path.join(root, distDir);
    const privateDirectory = path.join(root, 'private-data');
    await mkdir(privateDirectory);
    await writeFile(path.join(privateDirectory, 'keep.txt'), 'private fixture');
    await mkdir(path.join(directory, 'standalone'));
    await writeFile(path.join(directory, 'BUILD_ID'), 'synthetic-owned-build');
    await symlink(
      privateDirectory,
      path.join(directory, 'standalone/private-link'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await emulateNext(root);
    await saved.restore();
    await cleanup();
    await expect(lstat(directory)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(path.join(privateDirectory, 'keep.txt'), 'utf8')).toBe('private fixture');
    expect(await readFile(path.join(root, 'next-env.d.ts'), 'utf8')).toBe(envBefore);
    expect(await readFile(saved.checkpoint, 'utf8')).toContain('base64');
  });
});

it('does not adopt or remove an already existing test build', async () => {
  await workspace(async (root) => {
    const directory = path.join(root, distDir);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'keep.txt'), 'pre-existing build');
    const saved = await preserveNextGeneratedFiles({ root, distDir });
    await expect(saved.reserveTestBuild()).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(path.join(directory, 'keep.txt'), 'utf8')).toBe('pre-existing build');
  });
});

it('never reserves the persistent development build for cleanup', async () => {
  await workspace(async (root) => {
    const directory = path.join(root, '.work/next-build');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'keep.txt'), 'development build');
    const saved = await preserveNextGeneratedFiles({ root, distDir: '.work/next-build' });
    await expect(saved.reserveTestBuild()).rejects.toThrow('test build');
    expect(await readFile(path.join(directory, 'keep.txt'), 'utf8')).toBe('development build');
  });
});

it.each(['Next type paths', 'concurrent user edit'])(
  'keeps the owned build when %s have not been restored',
  async (kind) => {
    await workspace(async (root) => {
      const saved = await preserveNextGeneratedFiles({ root, distDir });
      const cleanup = await saved.reserveTestBuild();
      const artifact = path.join(root, distDir, 'keep.txt');
      await writeFile(artifact, 'owned build');
      if (kind === 'Next type paths') await emulateNext(root);
      else await writeFile(path.join(root, 'next-env.d.ts'), '// concurrent user edit\n');
      await expect(cleanup()).rejects.toThrow('restored');
      expect(await readFile(artifact, 'utf8')).toBe('owned build');
    });
  },
);

it.each(['replacement directory', 'linked directory'])(
  'refuses cleanup after the owned directory becomes a %s',
  async (kind) => {
    await workspace(async (root) => {
      const saved = await preserveNextGeneratedFiles({ root, distDir });
      const cleanup = await saved.reserveTestBuild();
      const directory = path.join(root, distDir);
      const original = directory + '-original';
      await writeFile(path.join(directory, 'keep.txt'), 'original owned build');
      await rename(directory, original);
      const replacement = path.join(root, 'replacement-data');
      await mkdir(replacement);
      await writeFile(path.join(replacement, 'keep.txt'), 'unowned data');
      if (kind === 'linked directory')
        await symlink(replacement, directory, process.platform === 'win32' ? 'junction' : 'dir');
      else {
        await mkdir(directory);
        await writeFile(path.join(directory, 'keep.txt'), 'unowned data');
      }
      await expect(cleanup()).rejects.toThrow(/linked|identity/);
      expect(await readFile(path.join(original, 'keep.txt'), 'utf8')).toBe('original owned build');
      expect(await readFile(path.join(directory, 'keep.txt'), 'utf8')).toBe('unowned data');
      expect(await readFile(path.join(replacement, 'keep.txt'), 'utf8')).toBe('unowned data');
    });
  },
);
