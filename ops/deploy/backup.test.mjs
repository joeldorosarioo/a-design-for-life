import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  backupTaskCommand,
  backupTaskName,
  CoolifyBackupError,
  parseCompletedBackupOutput,
  runPreDeploymentBackup,
  stagingBackupTaskUuid,
  verifyBackupEnvironment,
} from './backup.mjs';

const resourceUuid = '1tiveqtdwa1kxsjfhtugcjdp';
const executionUuid = 'execution123456789012345';
const oldExecutionUuid = 'previousexecution12345678';
const sourceImageTag = `sha256-${'c'.repeat(64)}`;
const timestamp = Date.parse('2026-11-06T12:00:00.000Z');
const iso = (delta = 0) => new Date(timestamp + delta).toISOString();
const namespace = { project: 'a-design-for-life', environment: 'staging', source: 'staging-app' };
const marker = () => ({
  version: 1,
  id: '3a8a9a5c-7a4d-4c32-96af-c137b08b3581',
  namespace: { ...namespace },
  createdAt: iso(),
  complete: true,
  completedAt: iso(),
  manifestSha256: 'a'.repeat(64),
  ciphertext: {
    key: 'sets/3a8a9a5c-7a4d-4c32-96af-c137b08b3581/payload.age',
    byteLength: 2898824,
    sha256: 'b'.repeat(64),
  },
});
const output = () => JSON.stringify({ status: 'backed-up', marker: marker(), durationMs: 20 });
const task = () => ({
  uuid: stagingBackupTaskUuid,
  name: backupTaskName,
  command: backupTaskCommand,
  enabled: true,
  timeout: 1800,
  container: null,
});
const runtime = () => [
  { key: 'APP_ENV', value: 'staging', real_value: 'staging', is_runtime: true, is_preview: false },
  {
    key: 'OPS_BACKUP_SOURCE',
    value: 'staging-app',
    real_value: 'staging-app',
    is_runtime: true,
    is_preview: false,
  },
  { key: 'SYNTHETIC_PRIVATE_KEY', value: 'never-include-in-receipt', is_runtime: true },
];
const execution = (status = 'success') => ({
  uuid: executionUuid,
  status,
  created_at: iso(),
  started_at: iso(),
  finished_at: status === 'success' || status === 'failed' ? iso() : null,
  message: output(),
});
const input = () => ({
  environment: 'staging',
  resourceUuid,
  taskUuid: stagingBackupTaskUuid,
  sourceImageTag,
});
const parse = (message, options = {}) =>
  parseCompletedBackupOutput(message, {
    namespace,
    requestedAt: timestamp,
    observedAt: timestamp,
    execution: { startedAt: timestamp, finishedAt: timestamp },
    ...options,
  });
function client({ previous = [], states = ['success'], onRequest } = {}) {
  const requests = [];
  const sleeps = [];
  let clock = timestamp;
  let executed = false;
  let polls = 0;
  return {
    requests,
    sleeps,
    dependencies: {
      now: () => clock,
      deadline: timestamp + 30,
      pollIntervalMs: 10,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      api: async (method, path, body, credentials) => {
        const request = { method, path, body, credentials };
        requests.push(request);
        const custom = await onRequest?.(request, { executed, polls, clock });
        if (custom !== undefined) return custom;
        if (path.endsWith('/execute')) {
          executed = true;
          return { message: 'Execution queued.' };
        }
        if (path.endsWith('/scheduled-tasks')) return [task()];
        if (path.endsWith('/envs')) return runtime();
        if (path.endsWith('/executions')) {
          if (!executed) return previous;
          const state = states[Math.min(polls++, states.length - 1)];
          return state === null ? previous : [execution(state), ...previous];
        }
        assert.fail('Unexpected offline API route.');
      },
    },
  };
}
const rejected = (code) => (error) => error instanceof CoolifyBackupError && error.code === code;

test('verifies one new completed native execution and returns only a technical receipt', async () => {
  const data = client({ states: ['running', 'success'] });
  const result = await runPreDeploymentBackup(input(), data.dependencies);
  assert.deepEqual(result, {
    status: 'backed-up',
    taskUuid: stagingBackupTaskUuid,
    executionUuid,
    sourceImageDigest: sourceImageTag.replace('-', ':'),
    marker: marker(),
    redactedIdentityFields: [],
    namespaceSha256Verified: false,
  });
  assert.deepEqual(data.sleeps, [10]);
  assert.equal(data.requests.filter((item) => item.method === 'POST').length, 1);
  assert(data.requests.every((item) => item.credentials.backupCredential === true));
  assert.equal(data.requests.filter((item) => item.path.endsWith('/envs')).length, 2);
  assert.equal(data.requests.filter((item) => item.path.endsWith('/scheduled-tasks')).length, 2);
  assert(!JSON.stringify(result).includes('never-include-in-receipt'));
});

test('requires both live public runtime values and rejects missing, duplicate, preview or changed identities', () => {
  assert.deepEqual(verifyBackupEnvironment(runtime(), 'staging'), namespace);
  for (const values of [
    {},
    [],
    runtime().slice(1),
    [...runtime(), runtime()[0]],
    runtime().map((item) => ({ ...item, is_runtime: false })),
    runtime().map((item) => ({ ...item, is_preview: true })),
    runtime().map((item) => ({ ...item, real_value: '<REDACTED>' })),
    runtime().map((item) =>
      item.key === 'OPS_BACKUP_SOURCE' ? { ...item, real_value: 'another-app' } : item,
    ),
  ])
    assert.throws(
      () => verifyBackupEnvironment(values, 'staging'),
      rejected('backup-environment-invalid'),
    );
});

test('reconstructs only exact known namespace redactions and verifies the optional canonical namespace hash', () => {
  const value = {
    status: 'backed-up',
    marker: marker(),
    namespaceSha256: createHash('sha256').update(JSON.stringify(namespace)).digest('hex'),
  };
  value.marker.namespace = { project: '<REDACTED>', environment: 'staging', source: '<REDACTED>' };
  assert.deepEqual(parse(JSON.stringify(value)), {
    marker: marker(),
    redactedIdentityFields: ['project', 'source'],
    namespaceSha256Verified: true,
  });
  for (const changed of ['[REDACTED]', 'other-app', '<REDACTED>suffix', null]) {
    value.marker.namespace.source = changed;
    assert.throws(() => parse(JSON.stringify(value)), rejected('backup-namespace-mismatch'));
  }
  value.marker.namespace = namespace;
  value.namespaceSha256 = 'd'.repeat(64);
  assert.throws(() => parse(JSON.stringify(value)), rejected('backup-namespace-mismatch'));
});

test('rejects incomplete, duplicate, hidden or malformed completion messages', () => {
  for (const message of [undefined, null, { marker: marker() }, 'x'.repeat(2 * 1024 * 1024 + 1)])
    assert.throws(() => parse(message), rejected('backup-output-unavailable'));
  for (const message of [
    '',
    '<REDACTED>',
    'Execution succeeded.',
    JSON.stringify({ status: 'pending', marker: marker() }),
    `${output()}\n${output()}`,
  ])
    assert.throws(() => parse(message), rejected('backup-marker-unavailable'));
  const wrapped = `Unrelated operational log\n${output()}\n`;
  assert.deepEqual(parse(wrapped).marker, marker());
});

test('never reconstructs redacted UUIDs, hashes, bytes, paths, timestamps or unknown marker fields', () => {
  const modifications = [
    (value) => {
      value.complete = false;
    },
    (value) => {
      delete value.completedAt;
    },
    (value) => {
      value.id = '<REDACTED>';
    },
    (value) => {
      value.id = [value.id];
    },
    (value) => {
      value.manifestSha256 = '<REDACTED>';
    },
    (value) => {
      value.manifestSha256 = [value.manifestSha256];
    },
    (value) => {
      value.ciphertext.sha256 = '<REDACTED>';
    },
    (value) => {
      value.ciphertext.key = 'sets/other/payload.age';
    },
    (value) => {
      value.ciphertext.byteLength = 0;
    },
    (value) => {
      value.ciphertext.byteLength = '2898824';
    },
    (value) => {
      value.ciphertext.byteLength = Number.MAX_SAFE_INTEGER + 1;
    },
    (value) => {
      value.createdAt = '<REDACTED>';
    },
    (value) => {
      value.namespace.extra = 'unknown';
    },
    (value) => {
      value.extra = 'unknown';
    },
  ];
  for (const modify of modifications) {
    const value = marker();
    modify(value);
    assert.throws(
      () => parse(JSON.stringify({ status: 'backed-up', marker: value })),
      rejected('backup-marker-invalid'),
    );
  }
});

test('accepts optional reviewed application provenance and refuses draft or redacted provenance', () => {
  const value = marker();
  value.application = {
    revision: 'e'.repeat(40),
    schemaSha256: 'f'.repeat(64),
    imageId: `sha256:${'d'.repeat(64)}`,
  };
  assert.deepEqual(
    parse(JSON.stringify({ status: 'backed-up', marker: value })).marker.application,
    value.application,
  );
  for (const revision of ['draft-uncommitted', '<REDACTED>', ['e'.repeat(40)]]) {
    value.application.revision = revision;
    assert.throws(
      () => parse(JSON.stringify({ status: 'backed-up', marker: value })),
      rejected('backup-marker-invalid'),
    );
  }
});

test('refuses stale, reversed or future marker timestamps', () => {
  for (const changes of [
    { createdAt: iso(-60_001) },
    { completedAt: iso(60_001) },
    { createdAt: iso(1), completedAt: iso() },
  ])
    assert.throws(
      () => parse(JSON.stringify({ status: 'backed-up', marker: { ...marker(), ...changes } })),
      rejected('backup-marker-stale'),
    );
});

test('does not accept an older successful execution after requesting a fresh backup', async () => {
  const old = { ...execution(), uuid: oldExecutionUuid };
  const data = client({ previous: [old], states: [null] });
  await assert.rejects(
    runPreDeploymentBackup(input(), data.dependencies),
    rejected('backup-timeout'),
  );
  assert.equal(data.requests.filter((item) => item.method === 'POST').length, 1);
  assert.deepEqual(data.sleeps, [10, 10, 10]);
});

test('refuses an overlapping backup without posting another execution', async () => {
  const data = client({ previous: [{ ...execution('running'), uuid: oldExecutionUuid }] });
  await assert.rejects(
    runPreDeploymentBackup(input(), data.dependencies),
    rejected('backup-already-running'),
  );
  assert(!data.requests.some((item) => item.method === 'POST'));
});

test('does not retry a failed or uncertain execution request', async () => {
  for (const failure of ['job', 'transport']) {
    const data = client({
      states: ['failed'],
      onRequest: (request) => {
        if (failure === 'transport' && request.method === 'POST')
          throw new Error('synthetic-transport-error');
      },
    });
    await assert.rejects(
      runPreDeploymentBackup(input(), data.dependencies),
      failure === 'job' ? rejected('backup-failed') : /synthetic-transport-error/,
    );
    assert.equal(data.requests.filter((item) => item.method === 'POST').length, 1);
  }
});

test('requires the exact reviewed task command and a sensitive-data-capable response before POST', async () => {
  for (const [changes, code] of [
    [{ command: undefined }, 'backup-command-unavailable'],
    [{ command: '<REDACTED>' }, 'backup-command-mismatch'],
    [{ command: `${backupTaskCommand}; other-command` }, 'backup-command-mismatch'],
    [{ uuid: 'otherbackuptask1234567890' }, 'backup-task-invalid'],
    [{ container: 'othercontainer1234567890' }, 'backup-task-invalid'],
  ]) {
    const data = client({
      onRequest: (request) =>
        request.path.endsWith('/scheduled-tasks') ? [{ ...task(), ...changes }] : undefined,
    });
    await assert.rejects(runPreDeploymentBackup(input(), data.dependencies), rejected(code));
    assert(!data.requests.some((item) => item.method === 'POST'));
  }
});

test('rechecks public identity and exact task command after completion', async () => {
  for (const target of ['envs', 'scheduled-tasks']) {
    const data = client({
      onRequest: (request, state) => {
        if (!state.executed) return;
        if (target === 'envs' && request.path.endsWith('/envs')) return [];
        if (target === 'scheduled-tasks' && request.path.endsWith('/scheduled-tasks'))
          return [{ ...task(), command: 'other-command' }];
      },
    });
    await assert.rejects(
      runPreDeploymentBackup(input(), data.dependencies),
      rejected(target === 'envs' ? 'backup-environment-invalid' : 'backup-command-mismatch'),
    );
  }
});

test('requires an unambiguous fresh execution identity and complete timestamps', async () => {
  for (const [changes, code] of [
    [{ uuid: '<REDACTED>' }, 'backup-execution-invalid'],
    [{ status: 'unknown-secret-status' }, 'backup-execution-invalid'],
    [{ created_at: iso(-60_001) }, 'backup-execution-stale'],
    [{ started_at: null }, 'backup-execution-invalid'],
    [{ finished_at: null }, 'backup-execution-invalid'],
    [{ finished_at: iso(-1) }, 'backup-execution-invalid'],
    [{ message: undefined }, 'backup-output-unavailable'],
    [
      {
        message: JSON.stringify({ status: 'backed-up', marker: { ...marker(), complete: false } }),
      },
      'backup-marker-invalid',
    ],
  ]) {
    const data = client({
      onRequest: (request, state) =>
        request.path.endsWith('/executions') && state.executed
          ? [{ ...execution(), ...changes }]
          : undefined,
    });
    await assert.rejects(runPreDeploymentBackup(input(), data.dependencies), rejected(code));
  }
  const data = client({
    onRequest: (request, state) =>
      request.path.endsWith('/executions') && state.executed
        ? [execution(), { ...execution(), uuid: oldExecutionUuid }]
        : undefined,
  });
  await assert.rejects(
    runPreDeploymentBackup(input(), data.dependencies),
    rejected('backup-execution-ambiguous'),
  );
});

test('binds staging to its configured task and refuses malformed or mutable source identities locally', async () => {
  for (const changed of [
    { sourceImageTag: 'latest' },
    { sourceImageTag: [sourceImageTag] },
    { resourceUuid: '../other-app' },
    { taskUuid: 'otherbackuptask1234567890' },
    { environment: 'preview' },
  ]) {
    const data = client();
    await assert.rejects(
      runPreDeploymentBackup({ ...input(), ...changed }, data.dependencies),
      CoolifyBackupError,
    );
    assert.equal(data.requests.length, 0);
  }
});

test('requires a new backup set id as well as a new execution id and rejects replayed completion output', async () => {
  const data = client({ previous: [{ ...execution(), uuid: oldExecutionUuid }] });
  await assert.rejects(
    runPreDeploymentBackup(input(), data.dependencies),
    rejected('backup-marker-reused'),
  );
  assert.equal(data.requests.filter((item) => item.method === 'POST').length, 1);
});
