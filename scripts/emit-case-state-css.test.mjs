import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { emitCaseStateCSS } from './emit-case-state-css.mjs';
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
async function fixture(operation) {
  const directory = await mkdtemp(path.join(tmpdir(), 'adfl-case-state-css-'));
  try {
    await mkdir(path.join(directory, 'src/stylesheets'), { recursive: true });
    await mkdir(path.join(directory, 'src/features/cases/stylesheets'), { recursive: true });
    for (const file of [
      'src/stylesheets/tokens.css',
      'src/features/cases/stylesheets/case-state-document.css',
    ])
      await copyFile(path.join(sourceRoot, file), path.join(directory, file));
    return await operation(directory);
  } finally {
    const allowed = path.resolve(tmpdir()) + path.sep + 'adfl-case-state-css-';
    if (!path.resolve(directory).startsWith(allowed))
      throw new Error('Unsafe CSS fixture cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
}
test('emits browser-ready tokens and negative shell CSS at the fixed public path without source directives', async () => {
  await fixture(async (root) => {
    const before = await readFile(path.join(root, 'src/stylesheets/tokens.css'), 'utf8');
    const output = await emitCaseStateCSS(root);
    assert.equal(output, path.join(root, 'public/_portfolio/case-state.css'));
    const css = await readFile(output, 'utf8');
    assert.doesNotMatch(css, /@(?:import|theme|tailwind)\b/);
    assert.match(css, /--color-cherry-cola-700:\s*#a3122f/);
    assert.match(css, /--font-sans:/);
    assert.match(css, /\.case-state-navigation\b/);
    assert.match(css, /\.case-state-contacts\b/);
    const header = css.match(/\.case-state-header\s*\{([^}]+)\}/)?.[1] ?? '';
    assert.match(header, /position:\s*sticky/);
    assert.match(header, /inset-block-start:\s*0/);
    assert.match(header, /max-height:\s*50svh/);
    assert.match(header, /overflow:\s*auto/);
    assert.match(css, /scroll-margin-block-start:\s*calc\(50svh \+ var\(--space-8\)\)/);
    assert.doesNotMatch(css, /sourceMappingURL|file:\/\/|E:[\\/]|C:[\\/]/i);
    assert.equal(await readFile(path.join(root, 'src/stylesheets/tokens.css'), 'utf8'), before);
    assert.equal(await readFile(await emitCaseStateCSS(root), 'utf8'), css);
  });
});
test('rebuilds from the canonical token source instead of a frozen copied palette', async () => {
  await fixture(async (root) => {
    const file = path.join(root, 'src/stylesheets/tokens.css');
    const input = await readFile(file, 'utf8');
    await writeFile(file, input.replace('#a3122f', '#123456'));
    const css = await readFile(await emitCaseStateCSS(root), 'utf8');
    assert.match(css, /--color-cherry-cola-700:\s*#123456/);
    assert.doesNotMatch(css, /#a3122f/);
  });
});
