import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft');

function inside(root, selected, allowRoot = false) {
  const relative = path.relative(root, selected);
  if (
    (!relative && !allowRoot) ||
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error('Backup runtime path escapes its workspace.');
  return relative;
}

async function optionalStat(selected) {
  try {
    return await lstat(selected);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Merge the CLI's dependency trace into the existing application standalone tree. */
export async function buildBackupRuntime(workspace, standalone) {
  const sourceRoot = await realpath(path.resolve(workspace));
  const destination = path.resolve(standalone);
  inside(sourceRoot, destination);
  let ancestor = destination;
  while (!(await optionalStat(ancestor))) ancestor = path.dirname(ancestor);
  inside(sourceRoot, await realpath(ancestor), true);
  await mkdir(path.join(destination, 'src'), { recursive: true });
  const targetRoot = await realpath(destination);
  inside(sourceRoot, targetRoot);
  // Trace from a fresh sibling: an existing standalone node_modules must not
  // shadow the original installed graph while resolving CLI dependencies.
  const scratch = await mkdtemp(path.join(sourceRoot, '.work/backup-runtime-build-'));
  await mkdir(path.join(scratch, 'src'));
  const output = path.join(scratch, 'src/backup-runtime.mjs');
  const entry = path.join(sourceRoot, 'ops/backup/runtime-entry.ts');
  try {
    const result = await build({
      absWorkingDir: sourceRoot,
      entryPoints: [entry],
      outfile: output,
      bundle: true,
      packages: 'external',
      platform: 'node',
      target: 'node24',
      format: 'esm',
      conditions: ['react-server'],
      tsconfig: path.join(sourceRoot, 'tsconfig.json'),
      metafile: true,
      logLevel: 'silent',
    });
    const imports = [
      ...new Set(
        Object.values(result.metafile.outputs).flatMap((item) =>
          item.imports.filter((item) => item.external).map((item) => item.path),
        ),
      ),
    ].sort();
    const trace = await nodeFileTrace([output], {
      base: sourceRoot,
      processCwd: sourceRoot,
      mixedModules: true,
      conditions: ['node', 'import', 'react-server'],
      // Dynamic filesystem helpers must never expand into .env, private data, or host files.
      ignore: (relative) => {
        const normalized = relative.replaceAll('\\', '/');
        return (
          normalized !== path.relative(sourceRoot, output).replaceAll('\\', '/') &&
          normalized !== 'package.json' &&
          !normalized.startsWith('node_modules/')
        );
      },
    });
    const aliases = imports
      .filter((specifier) => !specifier.startsWith('node:'))
      .map((specifier) =>
        path.join(
          'node_modules',
          ...specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1),
        ),
      );
    const rootLinks = [];
    for (const alias of aliases) {
      if ((await lstat(path.join(sourceRoot, alias))).isSymbolicLink()) rootLinks.push(alias);
    }
    const traced = await Promise.all(
      [...new Set([...trace.fileList, ...rootLinks])].sort().map(async (relative) => ({
        relative,
        link: (await lstat(path.resolve(sourceRoot, relative))).isSymbolicLink(),
      })),
    );
    const files = traced
      .sort((left, right) => Number(left.link) - Number(right.link))
      .map(({ relative }) => relative);
    let copiedFiles = 0;
    let copiedLinks = 0;
    for (const relative of files) {
      const source = path.resolve(sourceRoot, relative);
      if (source === output) continue;
      inside(sourceRoot, source);
      if (relative !== 'package.json' && !/^node_modules[\\/]/.test(relative))
        throw new Error('Unexpected application source in backup dependency trace.');
      const target = path.join(targetRoot, relative);
      inside(targetRoot, target);
      const metadata = await lstat(source);
      const resolved = await realpath(source);
      inside(sourceRoot, resolved);
      await mkdir(path.dirname(target), { recursive: true });
      inside(targetRoot, await realpath(path.dirname(target)), true);
      const existing = await optionalStat(target);
      if (metadata.isSymbolicLink()) {
        const expected = path.join(targetRoot, inside(sourceRoot, resolved));
        if (existing) {
          if (!existing.isSymbolicLink() || (await realpath(target)) !== (await realpath(expected)))
            throw new Error('Conflicting backup dependency link.');
          continue;
        }
        const link =
          process.platform === 'win32' ? expected : path.relative(path.dirname(target), expected);
        await symlink(link, target, process.platform === 'win32' ? 'junction' : 'dir');
        copiedLinks++;
      } else {
        if (!metadata.isFile()) throw new Error('Non-file backup dependency refused.');
        if (existing) {
          if (!existing.isFile() || existing.isSymbolicLink())
            throw new Error('Conflicting backup dependency file.');
          const [left, right] = await Promise.all([readFile(source), readFile(target)]);
          if (!left.equals(right)) throw new Error('Conflicting standalone backup dependency.');
        } else {
          await copyFile(source, target);
          copiedFiles++;
        }
      }
    }
    // NFT can omit pnpm aliases used through subpath exports. Complete only edges
    // whose package payload was already traced, keeping the installed lockfile graph.
    const dependencyDirectories = new Set(['node_modules', 'node_modules/.pnpm/node_modules']);
    for (const relative of files) {
      const match = /^(node_modules[\\/]\.pnpm[\\/][^\\/]+[\\/]node_modules)[\\/]/.exec(relative);
      if (match) dependencyDirectories.add(match[1]);
    }
    let completedPackageLinks = 0;
    for (const relative of dependencyDirectories) {
      const directory = path.join(sourceRoot, relative);
      if (!(await optionalStat(directory))) continue;
      const candidates = [];
      for (const item of await readdir(directory, { withFileTypes: true })) {
        if (item.name.startsWith('@') && item.isDirectory() && !item.isSymbolicLink()) {
          for (const scoped of await readdir(path.join(directory, item.name)))
            candidates.push(path.join(directory, item.name, scoped));
        } else if (item.isSymbolicLink()) candidates.push(path.join(directory, item.name));
      }
      for (const alias of candidates) {
        if (!(await lstat(alias)).isSymbolicLink()) continue;
        const resolved = await realpath(alias);
        inside(sourceRoot, resolved);
        const expected = path.join(targetRoot, inside(sourceRoot, resolved));
        if (!(await optionalStat(path.join(expected, 'package.json')))) continue;
        const target = path.join(targetRoot, inside(sourceRoot, alias));
        const existing = await optionalStat(target);
        if (existing) {
          if (!existing.isSymbolicLink() || (await realpath(target)) !== (await realpath(expected)))
            throw new Error('Conflicting traced package dependency alias.');
          continue;
        }
        await mkdir(path.dirname(target), { recursive: true });
        inside(targetRoot, await realpath(path.dirname(target)), true);
        await symlink(
          process.platform === 'win32' ? expected : path.relative(path.dirname(target), expected),
          target,
          process.platform === 'win32' ? 'junction' : 'dir',
        );
        completedPackageLinks++;
      }
    }
    const receipt = {
      version: 1,
      entrypoint: 'src/backup-runtime.mjs',
      conditions: ['react-server'],
      tracedFiles: files.length,
      copiedFiles,
      copiedLinks,
      completedPackageLinks,
      externalImports: imports,
    };
    await copyFile(output, path.join(targetRoot, 'src/backup-runtime.mjs'));
    await writeFile(
      path.join(targetRoot, 'src/backup-runtime-build.json'),
      JSON.stringify(receipt, null, 2) + '\n',
    );
    return receipt;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [workspace, standalone, ...extra] = process.argv.slice(2);
    if (!workspace || !standalone || extra.length)
      throw new Error('Expected workspace and standalone destination.');
    console.log(JSON.stringify(await buildBackupRuntime(workspace, standalone)));
  } catch {
    console.error('Backup runtime assembly failed.');
    process.exitCode = 1;
  }
}
