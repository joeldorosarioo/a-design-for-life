import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import profiles from './profiles.json';
import { measurementPlan, metricSummary } from './run-staging-audit.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = {
  environment: 'staging',
  origin: 'https://1tiveqtdwa1kxsjfhtugcjdp.200.141.19.143.sslip.io',
  sourceSha: 'a'.repeat(40),
  imageDigest: `sha256:${'b'.repeat(64)}`,
  profileSha256: createHash('sha256')
    .update(readFileSync(new URL('./profiles.json', import.meta.url)))
    .digest('hex'),
  targets: [
    { id: 'home-pt', kind: 'home', locale: 'pt', path: '/pt' },
    { id: 'home-en', kind: 'home', locale: 'en', path: '/en' },
    { id: 'cases-pt', kind: 'cases', locale: 'pt', path: '/pt/cases' },
    { id: 'cases-en', kind: 'cases', locale: 'en', path: '/en/cases' },
    { id: 'case-pt', kind: 'case', locale: 'pt', path: '/pt/cases/synthetic-case' },
    { id: 'case-en', kind: 'case', locale: 'en', path: '/en/cases/synthetic-case' },
  ],
};

function preflight(input: typeof config) {
  const directory = mkdtempSync(path.join(tmpdir(), 'adfl-audit-preflight-'));
  const file = path.join(directory, 'config.json');
  try {
    writeFileSync(file, JSON.stringify(input), { mode: 0o600 });
    return spawnSync(
      process.execPath,
      [
        'ops/performance/run-staging-audit.mjs',
        file,
        `.work/local-audits/preflight-test-${randomUUID()}`,
        '--preflight',
      ],
      { cwd: root, encoding: 'utf8', timeout: 10_000 },
    );
  } finally {
    rmSync(directory, { recursive: true });
  }
}

it('accepts a synthetic staging matrix without authenticating or opening a browser', () => {
  const result = preflight(config);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ ready: true, runs: 36, scenarios: 12 });
});

it('refuses a same-origin route that is not the declared portfolio scenario', () => {
  const result = preflight({
    ...config,
    targets: config.targets.map((target) =>
      target.id === 'home-pt' ? { ...target, path: '/pt/admin' } : target,
    ),
  });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
});

it('refuses another origin before opening a browser or reading staging credentials', () => {
  const result = preflight({ ...config, origin: 'https://production.invalid' });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
});

it('plans three independent measurements for all twelve page, language and device scenarios', () => {
  const plan: {
    target: { id: string };
    profile: { id: string };
    repeat: number;
  }[] = measurementPlan(profiles, config.targets);
  expect(plan).toHaveLength(36);
  expect(new Set(plan.map(({ target, profile }) => `${target.id}-${profile.id}`)).size).toBe(12);
  expect(plan.every(({ repeat }) => repeat >= 1 && repeat <= 3)).toBe(true);
});

it('rejects missing and duplicated locale targets before measuring', () => {
  expect(() => measurementPlan(profiles, config.targets.slice(1))).toThrow();
  expect(() => measurementPlan(profiles, [...config.targets, config.targets[0]])).toThrow();
});

it('reports median and variation while requiring all three finite nonnegative measurements', () => {
  expect(metricSummary([4, 1, 2])).toEqual({ median: 2, min: 1, max: 4, runs: 3 });
  expect(() => metricSummary([1, 2])).toThrow();
  expect(() => metricSummary([1, Number.NaN, 3])).toThrow();
  expect(() => metricSummary([1, -1, 3])).toThrow();
});
