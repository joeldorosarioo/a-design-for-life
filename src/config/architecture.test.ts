import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { analyzeArchitecture } from './architecture';

const workspace = path.resolve('.work');
const directories: string[] = [];

function graphFixture(files: Record<string, string>) {
  mkdirSync(workspace, { recursive: true });
  const directory = mkdtempSync(path.join(workspace, 'architecture-'));
  directories.push(directory);
  const fixtureFiles = {
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    ...files,
  };
  for (const [relative, contents] of Object.entries(fixtureFiles)) {
    const target = path.join(directory, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!path.resolve(directory).startsWith(`${workspace}${path.sep}architecture-`)) {
      throw new Error('Limpeza fora da fixture recusada');
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('fronteiras do grafo real', () => {
  // A missing boundary would let one feature couple to another feature's implementation.
  it('rejeita import interno de outra feature, por caminho relativo', () => {
    const directory = graphFixture({
      'src/features/cases/index.ts': "export { secret } from '../site-navigation/content/private';",
      'src/features/site-navigation/content/private.ts': 'export const secret = 1;',
    });
    expect(analyzeArchitecture(directory)).toContainEqual({
      rule: 'feature-public-entry-only',
      from: 'src/features/cases/index.ts',
      to: 'src/features/site-navigation/content/private.ts',
    });
  });
  // A cycle would make feature modules mutually dependent and fragile to initialize.
  it('rejeita dependência circular dentro da mesma feature', () => {
    const directory = graphFixture({
      'src/features/cases/index.ts': "export { value } from './content/value';",
      'src/features/cases/content/value.ts': "import '../index'; export const value = 1;",
    });
    expect(analyzeArchitecture(directory)).toContainEqual(
      expect.objectContaining({
        rule: 'no-cycles',
      }),
    );
  });
  // Generic infrastructure must not reach business features, even through composition modules.
  it.each(['helpers/log.ts', 'components/ui/button.ts'])(
    'rejeita %s dependendo de feature por ponte',
    (entry) => {
      const directory = graphFixture({
        [`src/${entry}`]: "import '@/config/bridge';",
        'src/config/bridge.ts': "import '@/features/cases';",
        'src/features/cases/index.ts': 'export const title = "synthetic";',
      });
      expect(analyzeArchitecture(directory)).toContainEqual({
        rule: 'generic-does-not-reach-features',
        from: `src/${entry}`,
        to: 'src/features/cases/index.ts',
      });
    },
  );
  // A filename-independent client directive must not pull private server modules through a shared module.
  it('rejeita cliente transitivo a server-only sem depender do nome do arquivo', () => {
    const directory = graphFixture({
      'src/features/cases/components/reader.tsx':
        "/* reader */ 'use strict'; 'use client'; import '../presentation';",
      'src/features/cases/presentation.ts': "import './server/database';",
      'src/features/cases/server/database.ts':
        "import 'server-only'; export const privateValue = 1;",
    });
    expect(analyzeArchitecture(directory)).toContainEqual({
      rule: 'client-cannot-reach-server',
      from: 'src/features/cases/components/reader.tsx',
      to: 'src/features/cases/server/database.ts',
    });
  });
  // Public server entries must carry the build-time server-only boundary even before a client consumes them.
  it('rejeita entrada server.ts sem marcador server-only', () => {
    const directory = graphFixture({
      'src/features/cases/server.ts': 'export const query = () => "private";',
    });
    expect(analyzeArchitecture(directory)).toContainEqual({
      rule: 'server-entry-needs-marker',
      from: 'src/features/cases/server.ts',
      to: 'server-only',
    });
  });
  // A shared barrel must not hide a server operation behind its public name.
  it('rejeita index.ts compartilhável que reexporta operação de servidor', () => {
    const directory = graphFixture({
      'src/features/cases/index.ts': "export { query } from './server/query';",
      'src/features/cases/server/query.ts':
        "import 'server-only'; export const query = () => 'private';",
    });
    expect(analyzeArchitecture(directory)).toContainEqual({
      rule: 'shared-entry-cannot-reach-server',
      from: 'src/features/cases/index.ts',
      to: 'src/features/cases/server/query.ts',
    });
  });
  // Conventionally server-only feature directories cannot become a bypass by omitting a marker.
  it.each(['server/query.ts', 'content/collection.ts'])(
    'rejeita cliente para %s mesmo sem marcador',
    (target) => {
      const directory = graphFixture({
        'src/features/cases/components/reader.tsx': `'use client'; import '../${target.replace('.ts', '')}';`,
        [`src/features/cases/${target}`]: 'export const privateValue = 1;',
      });
      expect(analyzeArchitecture(directory)).toContainEqual({
        rule: 'client-cannot-reach-server',
        from: 'src/features/cases/components/reader.tsx',
        to: `src/features/cases/${target}`,
      });
    },
  );
  it('também rejeita arquivo privado entre features usando alias', () => {
    const directory = graphFixture({
      'src/features/cases/content/load.ts': "import '@/features/site-navigation/content/private';",
      'src/features/site-navigation/content/private.ts': 'export const value = 1;',
    });
    expect(analyzeArchitecture(directory)).toContainEqual({
      rule: 'feature-public-entry-only',
      from: 'src/features/cases/content/load.ts',
      to: 'src/features/site-navigation/content/private.ts',
    });
  });

  it('permite entradas públicas, imports internos próprios e composição do Payload', () => {
    const directory = graphFixture({
      'src/features/cases/index.ts': 'export const title = "case";',
      'src/features/cases/server.ts':
        "import 'server-only'; export { query } from './server/query';",
      'src/features/cases/server/query.ts': 'export const query = () => 1;',
      'src/features/cases/content/collection.ts': 'export const collection = {};',
      'src/features/site-navigation/index.ts': "export { title } from '@/features/cases';",
      'src/features/site-navigation/server.ts':
        "import 'server-only'; export { query } from '@/features/cases/server';",
      'src/payload.config.ts': "import '@/features/cases/content/collection';",
      'src/app/page.ts': "import '@/features/cases/server'; import '@/features/site-navigation';",
      'src/app/(portfolio)/[locale]/page.ts':
        "import '@/features/cases/server'; import '@/features/site-navigation';",
      'src/app/(payload)/admin/importMap.js': "import '@/features/cases/content/collection';",
    });
    expect(analyzeArchitecture(directory)).toEqual([]);
  });

  it('permite import só de tipo e não confunde texto com diretiva cliente', () => {
    const directory = graphFixture({
      'src/features/cases/components/reader.tsx':
        "'use client'; import type { Shape } from '../server/schema'; export type Reader = Shape;",
      'src/features/cases/server/schema.ts':
        "import 'server-only'; export interface Shape { title: string }",
      'src/app/page.ts':
        "const text = 'use client'; import '../features/cases/server/schema'; export { text };",
    });
    expect(analyzeArchitecture(directory)).toEqual([]);
  });

  it('o grafo atual da aplicação respeita as mesmas regras', () => {
    expect(analyzeArchitecture(path.resolve('.'))).toEqual([]);
  });
  // ESLint should give immediate feedback before a private import reaches the graph gate.
  it('ESLint rejeita import relativo privado entre features', async () => {
    const eslint = new ESLint({ cwd: path.resolve('.') });
    const [result] = await eslint.lintText("import '../../site-navigation/content/private';", {
      filePath: 'src/features/cases/components/card.ts',
    });
    expect(result.messages.map((message) => message.ruleId)).toContain(
      'architecture/import-boundaries',
    );
  });
  it.each(['src/helpers/log.ts', 'src/components/ui/button.ts'])(
    'ESLint rejeita feature em %s',
    async (filePath) => {
      const eslint = new ESLint({ cwd: path.resolve('.') });
      const [result] = await eslint.lintText("import '@/features/cases';", { filePath });
      expect(result.messages.map((message) => message.ruleId)).toContain(
        'architecture/import-boundaries',
      );
    },
  );
  it.each([
    ['src/features/cases/components/card.ts', "import '../contracts/card';"],
    ['src/features/cases/components/card.ts', "export * from '@/features/site-navigation';"],
    ['src/features/cases/server/query.ts', "import '@/features/site-navigation/server';"],
    ['src/payload.config.ts', "import '@/features/cases/content/collection';"],
  ])('ESLint permite a relação aprovada em %s: %s', async (filePath, code) => {
    const eslint = new ESLint({ cwd: path.resolve('.') });
    const [result] = await eslint.lintText(code, { filePath });
    expect(
      result.messages.filter((message) => message.ruleId === 'architecture/import-boundaries'),
    ).toEqual([]);
  });
  it('rejeita ciclo só de tipos sem confundir isso com runtime cliente', () => {
    const directory = graphFixture({
      'src/features/cases/contracts/a.ts':
        "import type { B } from './b'; export type A = { next: B };",
      'src/features/cases/contracts/b.ts':
        "import type { A } from './a'; export type B = { previous: A };",
    });
    expect(analyzeArchitecture(directory)).toContainEqual(
      expect.objectContaining({ rule: 'no-cycles' }),
    );
  });
  // Public routes must compose a feature's interface, not bind to its private query path.
  it('rejeita rota pública importando consulta privada de feature', () => {
    const directory = graphFixture({
      'src/app/(portfolio)/[locale]/page.ts': "import '@/features/cases/server/query';",
      'src/features/cases/server/query.ts': 'export const query = () => 1;',
    });
    expect(analyzeArchitecture(directory)).toContainEqual({
      rule: 'portfolio-public-entry-only',
      from: 'src/app/(portfolio)/[locale]/page.ts',
      to: 'src/features/cases/server/query.ts',
    });
  });
  // Known Payload database APIs are server capabilities even without a local server-only marker.
  it.each([
    ['components/reader.tsx', 'payload', 'client-cannot-reach-server'],
    ['components/reader.tsx', '@payloadcms/db-postgres', 'client-cannot-reach-server'],
    ['index.ts', 'payload', 'shared-entry-cannot-reach-server'],
    ['index.ts', '@payloadcms/db-postgres', 'shared-entry-cannot-reach-server'],
  ])('rejeita capacidade %s → %s', (file, capability, rule) => {
    const source = `src/features/cases/${file}`;
    const directory = graphFixture({
      [source]:
        file === 'index.ts'
          ? `export * from '${capability}';`
          : `'use client'; import '${capability}';`,
    });
    expect(analyzeArchitecture(directory)).toContainEqual({ rule, from: source, to: source });
  });
  it('permite tipos Payload em cliente e index sem criar dependência runtime', () => {
    const directory = graphFixture({
      'src/features/cases/components/reader.tsx':
        "'use client'; import type { CollectionConfig } from 'payload'; export type Shape = CollectionConfig;",
      'src/features/cases/index.ts': "export type { CollectionConfig } from 'payload';",
    });
    expect(analyzeArchitecture(directory)).toEqual([]);
  });

  it('não classifica os componentes clientes nativos do Payload como banco', () => {
    const uiEntry = createRequire(
      path.resolve('node_modules/@payloadcms/next/package.json'),
    ).resolve('@payloadcms/ui');
    const directory = graphFixture({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@/*': ['./src/*'], '@payloadcms/ui': [uiEntry] } },
      }),
      'src/features/cases/components/control.tsx': "'use client'; import '@payloadcms/ui';",
    });
    expect(analyzeArchitecture(directory)).toEqual([]);
  });
});
