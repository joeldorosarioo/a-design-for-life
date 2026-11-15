import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

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
