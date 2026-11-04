import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const planPath = 'docs/specs/2026-10-29-portfolio-plano-implementacao.md';
const files = (stage) => [
  `docs/verification/progresso-etapa-${stage}.json`,
  `docs/verification/progresso-etapa-${stage}.md`,
  `docs/verification/execucao-etapa-${stage}.md`,
];
const counts2 = {
  completedItems: 29,
  totalItems: 30,
  percentage: 96.7,
  closedTasks: ['E2.1', 'E2.2', 'E2.3', 'E2.4', 'E2.5'],
  totalTasks: 6,
};
const counts3 = {
  completedItems: 7,
  totalItems: 30,
  percentage: 23.3,
  closedTasks: ['E3.1'],
  totalTasks: 6,
};
function input(stage) {
  return {
    stage,
    ...(stage === 2 ? counts2 : counts3),
    approval: stage === 2 ? 'A2 approved with screen-reader work outstanding' : 'A3 pending',
    remainingEstimate: '24–40 horas, excluindo esperas externas.',
    notes: ['Independent approval is never derived from completion.'],
    criteria: Array.from({ length: 30 }, (_, index) => {
      const id = `E${stage}.${Math.floor(index / 5) + 1}.${(index % 5) + 1}`;
      const done = stage === 2 ? id !== 'E2.6.2' : index < 7;
      return {
        id,
        done,
        summary: `Original criterion ${id}`,
        evidence: done ? 'fixture evidence' : 'Pending full proof',
      };
    }),
  };
}
async function fixture(operation) {
  const root = await mkdtemp(path.join(tmpdir(), 'adfl-stage-progress-'));
  try {
    await mkdir(path.join(root, 'scripts'), { recursive: true });
    await mkdir(path.join(root, 'docs/specs'), { recursive: true });
    await mkdir(path.join(root, 'docs/verification'), { recursive: true });
    await copyFile(
      path.join(sourceRoot, 'scripts/recalculate-stage-progress.mjs'),
      path.join(root, 'scripts/recalculate-stage-progress.mjs'),
    );
    await copyFile(path.join(sourceRoot, planPath), path.join(root, planPath));
    await symlink(
      path.join(sourceRoot, 'node_modules'),
      path.join(root, 'node_modules'),
      'junction',
    );
    for (const stage of [2, 3]) {
      const [json, md, ledger] = files(stage);
      await writeFile(path.join(root, json), JSON.stringify(input(stage)));
      await writeFile(
        path.join(root, md),
        '> Existing authorization update remains authoritative.\n\n# Progresso verificável\n',
      );
      await writeFile(
        path.join(root, ledger),
        `# Execution\n\n**Etapa ${stage}: old counters.**\n\nHistorical evidence remains.\n`,
      );
    }
    return await operation(root);
  } finally {
    const allowed = path.resolve(tmpdir()) + path.sep + 'adfl-stage-progress-';
    if (!path.resolve(root).startsWith(allowed))
      throw new Error('Unsafe progress fixture cleanup target.');
    await rm(root, { recursive: true, force: true });
  }
}
function run(root, args = []) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts/recalculate-stage-progress.mjs'), ...args],
    { cwd: root, encoding: 'utf8' },
  );
}
async function snapshot(root) {
  return Promise.all(
    [planPath, ...files(2), ...files(3)].map(async (file) => ({
      file,
      text: await readFile(path.join(root, file), 'utf8').catch(() => null),
      modified: (await stat(path.join(root, file)).catch(() => null))?.mtimeMs,
    })),
  );
}
async function edit(root, stage, change) {
  const file = path.join(root, files(stage)[0]);
  const data = JSON.parse(await readFile(file, 'utf8'));
  change(data);
  await writeFile(file, JSON.stringify(data));
}
function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

test('explicit stage 3 writes its own plan counts, ledger and independent approval without changing stage 2', async () => {
  await fixture(async (root) => {
    const before = await snapshot(root);
    const result = run(root, ['--stage', '3']);
    assertSuccess(result);
    const output = JSON.parse(result.stdout);
    for (const [key, expected] of Object.entries(counts3)) assert.deepEqual(output[key], expected);
    const [json, md, ledger] = await Promise.all(
      files(3).map((file) => readFile(path.join(root, file), 'utf8')),
    );
    const stored = JSON.parse(json);
    assert.equal(stored.approval, 'A3 pending');
    assert.equal(stored.completedItems, 7);
    assert.match(md, /23,3%: 7\/30 itens; 1\/6 tarefas/);
    assert.match(md, /\| E3\.1\s*\| 5\/5\s*\| Encerrada/);
    assert.match(md, /\| E3\.2\s*\| 2\/5/);
    assert.match(md, /A3 pending/);
    assert.match(ledger, /Etapa 3: 23,3%.*7\/30.*A3 pending/);
    assert.match(ledger, /Historical evidence remains/);
    assert.deepEqual(
      (await snapshot(root)).filter((entry) => !files(3).includes(entry.file)),
      before.filter((entry) => !files(3).includes(entry.file)),
    );
  });
});

test('default stage 2 retains 29/30, accepted A2 text and its authorization notice independently of incomplete work', async () => {
  await fixture(async (root) => {
    const stage3 = (await snapshot(root)).filter((entry) => files(3).includes(entry.file));
    const result = run(root);
    assertSuccess(result);
    const output = JSON.parse(result.stdout);
    for (const [key, expected] of Object.entries(counts2)) assert.deepEqual(output[key], expected);
    for (const file of files(2).slice(1)) {
      const text = await readFile(path.join(root, file), 'utf8');
      assert.match(text, /A2 approved with screen-reader work outstanding/);
      assert.doesNotMatch(text, /A2 pendente|etapa3 depende/);
    }
    assert.match(
      await readFile(path.join(root, files(2)[1]), 'utf8'),
      /^> Existing authorization update remains authoritative\./,
    );
    assert.deepEqual(
      (await snapshot(root)).filter((entry) => files(3).includes(entry.file)),
      stage3,
    );
  });
});

for (const stage of [2, 3])
  test(`stage ${stage} --check accepts current counts without any write`, async () => {
    await fixture(async (root) => {
      const before = await snapshot(root);
      const result = run(root, ['--check', '--stage', String(stage)]);
      assertSuccess(result);
      assert.equal(JSON.parse(result.stdout).completedItems, stage === 2 ? 29 : 7);
      assert.deepEqual(await snapshot(root), before);
    });
  });

for (const [field, stale] of Object.entries({
  completedItems: 0,
  totalItems: 29,
  percentage: 0,
  closedTasks: [],
  totalTasks: 5,
})) {
  test(`--check rejects stale ${field} without writing`, async () => {
    await fixture(async (root) => {
      await edit(root, 3, (data) => {
        data[field] = stale;
      });
      const before = await snapshot(root);
      const result = run(root, ['--stage', '3', '--check']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /stale/i);
      assert.deepEqual(await snapshot(root), before);
    });
  });
}

for (const [name, change] of [
  ['missing criterion', (data) => data.criteria.pop()],
  [
    'duplicate criterion',
    (data) => {
      data.criteria[29] = data.criteria[0];
    },
  ],
  [
    'foreign criterion',
    (data) => {
      data.criteria[29].id = 'E2.6.5';
    },
  ],
  [
    'nonboolean completion',
    (data) => {
      data.criteria[0].done = 'true';
    },
  ],
  [
    'completed without evidence',
    (data) => {
      data.criteria[0].evidence = '   ';
    },
  ],
  [
    'nonstrings as evidence',
    (data) => {
      data.criteria[0].evidence = true;
    },
  ],
  [
    'missing summary',
    (data) => {
      data.criteria[0].summary = '';
    },
  ],
  [
    'missing approval',
    (data) => {
      delete data.approval;
    },
  ],
  [
    'wrong stage',
    (data) => {
      data.stage = 2;
    },
  ],
])
  test(`rejects ${name} before any write`, async () => {
    await fixture(async (root) => {
      await edit(root, 3, change);
      const before = await snapshot(root);
      const result = run(root, ['--stage', '3']);
      assert.notEqual(result.status, 0);
      assert.deepEqual(await snapshot(root), before);
    });
  });

for (const args of [
  ['--stage'],
  ['--stage', '4'],
  ['--stage', '03'],
  ['--stage', '2x'],
  ['--stage=3'],
  ['--stage', '3', '--stage', '2'],
  ['--check', '--check'],
  ['--unknown'],
  ['3'],
  ['--stage', '--check'],
  ['--root', '..'],
])
  test(`rejects malformed arguments ${JSON.stringify(args)} without writing`, async () => {
    await fixture(async (root) => {
      const before = await snapshot(root);
      const result = run(root, args);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /argument|stage|usage/i);
      assert.deepEqual(await snapshot(root), before);
    });
  });

for (const [name, mutate] of [
  ['duplicate task', (plan) => plan.replace('### E3.6 ', '### E3.5 ')],
  ['missing task', (plan) => plan.replace('### E3.6 ', '### E9.6 ')],
  [
    'missing original criterion',
    (plan) => plan.replace('- [ ] Levantar acessos existentes;', '- Levantar acessos existentes;'),
  ],
])
  test(`rejects plan with ${name} before writing`, async () => {
    await fixture(async (root) => {
      const file = path.join(root, planPath);
      await writeFile(file, mutate(await readFile(file, 'utf8')));
      const before = await snapshot(root);
      const result = run(root, ['--stage', '3']);
      assert.notEqual(result.status, 0);
      assert.deepEqual(await snapshot(root), before);
    });
  });

for (const missing of [files(3)[0], files(3)[2]])
  test(`missing input ${missing} cannot cause partial updates`, async () => {
    await fixture(async (root) => {
      await rm(path.join(root, missing));
      const before = await snapshot(root);
      assert.notEqual(run(root, ['--stage', '3']).status, 0);
      assert.deepEqual(await snapshot(root), before);
    });
  });

test('missing ledger progress marker cannot cause partial updates', async () => {
  await fixture(async (root) => {
    await writeFile(path.join(root, files(3)[2]), '# Historical ledger without current marker\n');
    const before = await snapshot(root);
    assert.notEqual(run(root, ['--stage', '3']).status, 0);
    assert.deepEqual(await snapshot(root), before);
  });
});

test('all completed criteria still leave input A3 approval pending', async () => {
  await fixture(async (root) => {
    await edit(root, 3, (data) => {
      for (const criterion of data.criteria) {
        criterion.done = true;
        criterion.evidence = 'full fixture proof';
      }
    });
    const result = run(root, ['--stage', '3']);
    assertSuccess(result);
    const output = JSON.parse(result.stdout);
    assert.equal(output.percentage, 100);
    assert.equal(output.closedTasks.length, 6);
    assert.match(await readFile(path.join(root, files(3)[1]), 'utf8'), /A3 pending/);
  });
});
