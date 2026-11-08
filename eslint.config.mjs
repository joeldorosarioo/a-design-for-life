import path from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Rule.RuleModule} */
const importBoundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      privateFeature: 'Importe outra feature somente por index.ts ou server.ts.',
      genericFeature: 'Helpers e componentes genéricos não dependem de features.',
    },
  },
  create(context) {
    const sourceFile = path.relative(context.cwd, context.filename).split(path.sep).join('/');
    const sourceFeature = /^src\/features\/([^/]+)\//.exec(sourceFile)?.[1];
    function inspect(specifier, node) {
      if (typeof specifier !== 'string') return;
      let target;
      if (specifier.startsWith('@/')) target = `src/${specifier.slice(2)}`;
      else if (specifier.startsWith('.'))
        target = path.posix.join(path.posix.dirname(sourceFile), specifier);
      else return;
      const targetFeature = /^src\/features\/([^/]+)(?:\/(.*))?$/.exec(target);
      if (!targetFeature) return;
      if (/^src\/(helpers|components)\//.test(sourceFile)) {
        context.report({ node, messageId: 'genericFeature' });
        return;
      }
      if (!sourceFeature || targetFeature[1] === sourceFeature) return;
      if (['', 'index', 'index.ts', 'server', 'server.ts'].includes(targetFeature[2] ?? '')) return;
      context.report({ node, messageId: 'privateFeature' });
    }
    return {
      ImportDeclaration(node) {
        inspect(node.source.value, node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source) inspect(node.source.value, node.source);
      },
      ExportAllDeclaration(node) {
        inspect(node.source.value, node.source);
      },
      ImportExpression(node) {
        inspect(node.source.value, node.source);
      },
    };
  },
};

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: { architecture: { rules: { 'import-boundaries': importBoundaries } } },
    rules: { 'architecture/import-boundaries': 'error' },
  },
  globalIgnores(['.next/**', '.toolchain/**', '.work/**', 'src/payload-types.ts', 'next-env.d.ts']),
]);
