import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveNextDistDir, assertUnlinkedWorkspacePath } from '../../src/config/next-dist';

/** Only known Next16 type-path generation may be restored over the current files. */
export async function preserveNextGeneratedFiles(input: { root: string; distDir: string }) {
  const root = path.resolve(input.root);
  const distDir = resolveNextDistDir({ NEXT_TEST_DIST_DIR: input.distDir }, root);
  const names = ['next-env.d.ts', 'tsconfig.json'] as const;
  async function readSources() {
    return Promise.all(
      names.map(async (name) => {
        const file = path.join(root, name);
        assertUnlinkedWorkspacePath(file, root);
        const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink()) throw new Error('Linked Next source refused');
        return readFile(file);
      }),
    );
  }
  const before = await readSources();
  const config = JSON.parse(before[1].toString()) as { include?: unknown; [key: string]: unknown };
  if (!Array.isArray(config.include) || !config.include.every((entry) => typeof entry === 'string'))
    throw new Error('Expected the controlled project TypeScript include list');
  const include = [...config.include];
  for (const entry of [`${distDir}/types/**/*.ts`, `${distDir}/dev/types/**/*.ts`])
    if (!include.includes(entry)) include.push(entry);
  const expectedConfig = JSON.stringify({ ...config, include }, null, 2) + '\n';
  const expectedEnv = before[0]
    .toString()
    .replace(
      /^import[ \t]+["'][^"'\r\n]*\/types\/(routes|root-params)\.d\.ts["'];?[ \t]*\r?$/gm,
      (_line, kind: string) => `import "./${distDir}/types/${kind}.d.ts";`,
    );
  const directory = path.join(root, '.work/next-source-checkpoints', randomUUID());
  assertUnlinkedWorkspacePath(directory, root);
  await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  assertUnlinkedWorkspacePath(directory, root);
  await mkdir(directory, { mode: 0o700 });
  const checkpoint = path.join(directory, 'source-before.json');
  await writeFile(
    checkpoint,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        distDir,
        files: names.map((name, index) => ({ name, base64: before[index].toString('base64') })),
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  const normalize = (text: string) => text.replaceAll('\r\n', '\n');
  return {
    checkpoint,
    async reserveTestBuild() {
      if (!distDir.startsWith('.work/next-tests/'))
        throw new Error('Only an isolated test build can be reserved for cleanup');
      const buildDirectory = path.join(root, distDir);
      assertUnlinkedWorkspacePath(buildDirectory, root);
      await mkdir(path.dirname(buildDirectory), { recursive: true, mode: 0o700 });
      assertUnlinkedWorkspacePath(buildDirectory, root);
      await mkdir(buildDirectory, { mode: 0o700 });
      const owned = await lstat(buildDirectory);
      return async () => {
        assertUnlinkedWorkspacePath(buildDirectory, root);
        const current = await lstat(buildDirectory);
        if (
          !current.isDirectory() ||
          current.isSymbolicLink() ||
          current.dev !== owned.dev ||
          current.ino !== owned.ino
        )
          throw new Error('Owned test build identity changed; cleanup refused');
        if ((await readSources()).some((bytes, index) => !bytes.equals(before[index])))
          throw new Error('Original Next source files must be restored before build cleanup');
        await rm(buildDirectory, { recursive: true, maxRetries: 3 });
      };
    },
    async restore(): Promise<'unchanged' | 'restored'> {
      const current = await readSources();
      const expected = [expectedEnv, expectedConfig];
      // Validate BOTH before the first write. User/agent changes remain untouched.
      if (
        current.some(
          (bytes, index) =>
            !bytes.equals(before[index]) &&
            normalize(bytes.toString()) !== normalize(expected[index]),
        )
      )
        throw new Error('Next source files changed unexpectedly; inspect the retained checkpoint');
      let changed = false;
      for (const [index, name] of names.entries()) {
        if (current[index].equals(before[index])) continue;
        await writeFile(path.join(root, name), before[index]);
        changed = true;
      }
      return changed ? 'restored' : 'unchanged';
    },
  };
}
