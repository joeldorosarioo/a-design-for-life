import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  realpath,
  readlink,
  rm,
  symlink,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { assembleOptionalCanvas } from './assemble-standalone.mjs';

const owned: string[] = [];
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
afterEach(async () => {
  for (const directory of owned.splice(0)) await rm(directory, { recursive: true, force: true });
});

async function packageAt(directory: string, name: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', main: 'index.cjs' }),
  );
  await writeFile(path.join(directory, 'index.cjs'), 'module.exports = { fixture: true };\n');
}

async function fixture(
  options: { externalCanvas?: boolean; missingTarget?: boolean; escapedDestination?: boolean } = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'adfl-standalone-'));
  owned.push(directory);
  const root = path.join(directory, 'workspace');
  const standalone = path.join(root, 'dist', 'standalone');
  const pdfRelative = 'node_modules/.pnpm/pdf-fixture/node_modules/pdfjs-dist';
  const canvasRelative = 'node_modules/.pnpm/canvas-fixture/node_modules/@napi-rs/canvas';
  const pdf = path.join(root, pdfRelative);
  const canvas = options.externalCanvas
    ? path.join(directory, 'external-canvas')
    : path.join(root, canvasRelative);
  await packageAt(root, 'synthetic-application');
  await packageAt(pdf, 'pdfjs-dist');
  await packageAt(canvas, '@napi-rs/canvas');
  await mkdir(path.join(root, 'node_modules'), { recursive: true });
  await symlink(pdf, path.join(root, 'node_modules', 'pdfjs-dist'), linkType);
  const sourceLink = path.join(path.dirname(pdf), '@napi-rs', 'canvas');
  await mkdir(path.dirname(sourceLink), { recursive: true });
  await symlink(canvas, sourceLink, linkType);
  await packageAt(path.join(standalone, pdfRelative), 'pdfjs-dist');
  if (!options.missingTarget)
    await packageAt(path.join(standalone, canvasRelative), '@napi-rs/canvas');
  await symlink(
    path.join(standalone, pdfRelative),
    path.join(standalone, 'node_modules', 'pdfjs-dist'),
    linkType,
  );
  const destinationLink = path.join(standalone, path.relative(root, sourceLink));
  if (options.escapedDestination) {
    const external = path.join(directory, 'external-output');
    await mkdir(external);
    await symlink(external, path.dirname(destinationLink), linkType);
  }
  return { root, standalone, destinationLink, canvasTarget: path.join(standalone, canvasRelative) };
}

it('restores the optional dependency graph so the real module loader resolves traced canvas', async () => {
  const selected = await fixture();
  const loadCanvas = () =>
    spawnSync(
      process.execPath,
      [
        '--no-global-search-paths',
        '-e',
        "const loader = require('node:module').createRequire(process.argv[1]); console.log(JSON.stringify(loader('@napi-rs/canvas')));",
        path.join(
          selected.standalone,
          'node_modules/.pnpm/pdf-fixture/node_modules/pdfjs-dist/package.json',
        ),
      ],
      { encoding: 'utf8', windowsHide: true },
    );
  const before = loadCanvas();
  expect(before.status).toBe(1);
  expect(before.stderr).toContain('MODULE_NOT_FOUND');
  const receipt = await assembleOptionalCanvas(selected.root, selected.standalone);
  expect(await realpath(selected.destinationLink)).toBe(await realpath(selected.canvasTarget));
  expect(path.isAbsolute(receipt.target)).toBe(false);
  if (process.platform !== 'win32')
    expect(path.isAbsolute(await readlink(selected.destinationLink))).toBe(false);
  expect(await readFile(path.join(selected.destinationLink, 'index.cjs'), 'utf8')).toContain(
    'fixture',
  );
  const loaded = loadCanvas();
  expect(loaded.status).toBe(0);
  expect(JSON.parse(loaded.stdout)).toEqual({ fixture: true });
  await expect(assembleOptionalCanvas(selected.root, selected.standalone)).resolves.toMatchObject({
    status: 'existing',
  });
});

it('refuses an installed optional dependency outside the workspace', async () => {
  const selected = await fixture({ externalCanvas: true });
  await expect(assembleOptionalCanvas(selected.root, selected.standalone)).rejects.toThrow(
    /outside/i,
  );
});

it('refuses missing traced destination files rather than copying unbounded dependencies', async () => {
  const selected = await fixture({ missingTarget: true });
  await expect(assembleOptionalCanvas(selected.root, selected.standalone)).rejects.toThrow(
    /missing/i,
  );
});

it('refuses a destination parent link that escapes the standalone root', async () => {
  const selected = await fixture({ escapedDestination: true });
  await expect(assembleOptionalCanvas(selected.root, selected.standalone)).rejects.toThrow(
    /outside/i,
  );
});
