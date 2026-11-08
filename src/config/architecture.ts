import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import type { ICruiseResult } from 'dependency-cruiser';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

export interface ArchitectureViolation {
  rule: string;
  from: string;
  to: string;
}

export function analyzeArchitecture(rootDirectory: string): ArchitectureViolation[] {
  const result = spawnSync(
    process.execPath,
    [
      path.join(projectRoot, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
      '--config',
      path.join(projectRoot, 'dependency-cruiser.config.cjs'),
      '--output-type',
      'json',
      'src',
    ],
    { cwd: rootDirectory, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  if (!result.stdout.trim().startsWith('{')) {
    throw new Error(`Falha ao analisar dependências: ${result.stderr}`);
  }
  const graph = JSON.parse(result.stdout) as ICruiseResult;
  const violations = graph.summary.violations.map((violation) => ({
    rule: violation.rule.name,
    from: violation.from,
    to: violation.to,
  }));
  const modules = new Map(graph.modules.map((entry) => [entry.source, entry]));
  const markedServerModules = new Set(
    graph.modules
      .filter((entry) =>
        entry.dependencies.some(
          (dependency) =>
            dependency.module === 'server-only' &&
            !dependency.dependencyTypes.includes('type-only'),
        ),
      )
      .map((entry) => entry.source),
  );

  const serverModules = new Set([
    ...markedServerModules,
    ...graph.modules
      .filter(
        (entry) =>
          /^src\/features\/[^/]+\/(?:server\.ts$|server\/|content\/)/.test(entry.source) ||
          entry.dependencies.some(
            (dependency) =>
              !dependency.dependencyTypes.includes('type-only') &&
              (dependency.module === 'payload' ||
                /^@payloadcms\/db-[^/]+(?:\/.*)?$/.test(dependency.module)),
          ),
      )
      .map((entry) => entry.source),
  ]);

  for (const entry of graph.modules.filter((candidate) => candidate.source.startsWith('src/'))) {
    if (
      /^src\/features\/[^/]+\/server\.ts$/.test(entry.source) &&
      !markedServerModules.has(entry.source)
    ) {
      violations.push({
        rule: 'server-entry-needs-marker',
        from: entry.source,
        to: 'server-only',
      });
    }
    const source = ts.createSourceFile(
      entry.source,
      readFileSync(path.join(rootDirectory, entry.source), 'utf8'),
      ts.ScriptTarget.Latest,
    );
    let client = false;
    for (const statement of source.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
      if (statement.expression.text === 'use client') client = true;
    }
    const sharedEntry = /^src\/features\/[^/]+\/index\.ts$/.test(entry.source);
    if (!client && !sharedEntry) continue;
    const rule = sharedEntry ? 'shared-entry-cannot-reach-server' : 'client-cannot-reach-server';
    const seen = new Set<string>();
    const pending = [entry.source];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      if (serverModules.has(current)) {
        violations.push({ rule, from: entry.source, to: current });
      }
      for (const dependency of modules.get(current)?.dependencies ?? []) {
        if (!dependency.dependencyTypes.includes('type-only')) pending.push(dependency.resolved);
      }
    }
  }
  return violations;
}
