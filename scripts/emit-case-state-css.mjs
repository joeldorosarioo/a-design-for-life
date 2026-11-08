import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
export async function emitCaseStateCSS(root = fileURLToPath(new URL('../', import.meta.url))) {
  const source = path.join(root, 'src/features/cases/stylesheets/case-state-document.css');
  const target = path.join(root, 'public/_portfolio/case-state.css');
  const result = await postcss([
    tailwindcss({ base: root, optimize: false, transformAssetUrls: false }),
  ]).process(await readFile(source, 'utf8'), { from: source, to: target, map: false });
  if (result.warnings().length || /@(?:import|theme|tailwind)\b/.test(result.css))
    throw new Error('Case state stylesheet was not completely compiled.');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, result.css);
  return target;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await emitCaseStateCSS();
