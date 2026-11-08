import { lstat, mkdir, readFile, realpath, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function inside(root, selected, allowRoot = false) {
  const relative = path.relative(root, selected);
  if (
    (!relative && !allowRoot) ||
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error('Optional dependency path is outside its owned root.');
  return relative;
}

async function existingParentInside(root, selected) {
  let current = path.dirname(selected);
  while (true) {
    try {
      inside(root, await realpath(current), true);
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw new Error('Missing owned standalone parent.');
      current = parent;
    }
  }
}

// NFT traces the canvas files explicitly but cannot infer the dependency edge
// used inside the PDF parser's dynamically constructed worker source.
export async function assembleOptionalCanvas(workspace, standalone) {
  const sourceRoot = await realpath(path.resolve(workspace));
  const targetRoot = await realpath(path.resolve(standalone));
  inside(sourceRoot, targetRoot);
  const applicationRequire = createRequire(path.join(sourceRoot, 'package.json'));
  const pdfPackage = applicationRequire.resolve('pdfjs-dist/package.json');
  inside(sourceRoot, await realpath(pdfPackage));
  const pdfRequire = createRequire(pdfPackage);
  const canvasPackage = await realpath(pdfRequire.resolve('@napi-rs/canvas/package.json'));
  inside(sourceRoot, canvasPackage);
  const canvasSource = path.dirname(canvasPackage);
  let sourceLink;
  for (const modules of pdfRequire.resolve.paths('@napi-rs/canvas') ?? []) {
    const candidate = path.join(modules, '@napi-rs/canvas');
    try {
      inside(sourceRoot, candidate);
      if (
        (await lstat(candidate)).isSymbolicLink() &&
        path.relative(canvasSource, await realpath(candidate)) === ''
      ) {
        sourceLink = candidate;
        break;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!sourceLink) throw new Error('Missing installed optional dependency link.');
  const target = path.join(targetRoot, inside(sourceRoot, canvasSource));
  let resolvedTarget;
  try {
    resolvedTarget = await realpath(target);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Missing traced optional dependency target.');
    throw error;
  }
  inside(targetRoot, resolvedTarget);
  const sourceMetadata = JSON.parse(await readFile(canvasPackage, 'utf8'));
  const targetMetadata = JSON.parse(
    await readFile(path.join(resolvedTarget, 'package.json'), 'utf8'),
  );
  if (
    sourceMetadata.name !== '@napi-rs/canvas' ||
    targetMetadata.name !== sourceMetadata.name ||
    targetMetadata.version !== sourceMetadata.version
  )
    throw new Error('Traced optional dependency does not match the installed package.');
  const destination = path.join(targetRoot, inside(sourceRoot, sourceLink));
  await existingParentInside(targetRoot, destination);
  const relativeTarget = path.relative(path.dirname(destination), target);
  const receipt = { link: path.relative(targetRoot, destination), target: relativeTarget };
  let existing;
  try {
    existing = await lstat(destination);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    if (
      !existing.isSymbolicLink() ||
      path.relative(resolvedTarget, await realpath(destination)) !== ''
    )
      throw new Error('Conflicting standalone optional dependency path.');
    return { ...receipt, status: 'existing' };
  }
  await mkdir(path.dirname(destination), { recursive: true });
  inside(targetRoot, await realpath(path.dirname(destination)));
  // Windows test fixtures use junctions; only Linux artifacts are promotable.
  await symlink(
    process.platform === 'win32' ? target : relativeTarget,
    destination,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  return { ...receipt, status: 'created' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [workspace, standalone, ...extra] = process.argv.slice(2);
    if (!workspace || !standalone || extra.length)
      throw new Error('Expected workspace and standalone roots.');
    console.log(JSON.stringify(await assembleOptionalCanvas(workspace, standalone)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Standalone assembly failed.');
    process.exitCode = 1;
  }
}
