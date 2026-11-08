import { createHash } from 'node:crypto';

export const stagingBackupTaskUuid = 'lqtmrgwvbnnmd1oyodjisrhx';
export const backupTaskName = 'encrypted-full-backup';
export const backupTaskCommand = 'node --conditions=react-server src/backup-runtime.mjs backup';
const resourceId = /^[a-zA-Z0-9]{12,64}$/;
const backupId = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const revision = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const sourceTag = /^sha256-[a-f0-9]{64}$/;
const redacted = '<REDACTED>'; // Coolify 4.6.0's exact log-redaction token.
const maximumMessageBytes = 2 * 1024 * 1024;
const states = new Set(['queued', 'pending', 'running', 'success', 'failed']);
const terminal = new Set(['success', 'failed']);

export class CoolifyBackupError extends Error {
  constructor(code) {
    super(`Pre-deployment backup refused or incomplete (${code}).`);
    this.name = 'CoolifyBackupError';
    this.code = code;
  }
}
function requireBackup(condition, code) {
  if (!condition) throw new CoolifyBackupError(code);
}
function matches(pattern, value) {
  return typeof value === 'string' && pattern.test(value);
}
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, required, optional = []) {
  return (
    record(value) &&
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  );
}
function markerTimestamp(value) {
  requireBackup(typeof value === 'string', 'backup-marker-invalid');
  const time = Date.parse(value);
  requireBackup(
    Number.isFinite(time) && new Date(time).toISOString() === value,
    'backup-marker-invalid',
  );
  return time;
}
function executionTimestamp(value) {
  if (value === null || value === undefined) return undefined;
  requireBackup(
    typeof value === 'string' && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d/.test(value),
    'backup-execution-invalid',
  );
  const normalized = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const time = Date.parse(normalized);
  requireBackup(Number.isFinite(time), 'backup-execution-invalid');
  return time;
}
function namespaceFor(environment) {
  return { project: 'a-design-for-life', environment, source: `${environment}-app` };
}
function namespaceSha256(namespace) {
  return createHash('sha256').update(JSON.stringify(namespace)).digest('hex');
}

/** Read only these public values from the sensitive API response; never return other env data. */
export function verifyBackupEnvironment(values, environment) {
  requireBackup(Array.isArray(values), 'backup-environment-invalid');
  const expected = { APP_ENV: environment, OPS_BACKUP_SOURCE: `${environment}-app` };
  for (const [key, wanted] of Object.entries(expected)) {
    const matches = values.filter(
      (item) => record(item) && item.key === key && item.is_preview !== true,
    );
    requireBackup(
      matches.length === 1 && matches[0].is_runtime === true,
      'backup-environment-invalid',
    );
    const resolved = matches[0].real_value ?? matches[0].value;
    requireBackup(resolved === wanted, 'backup-environment-invalid');
  }
  return namespaceFor(environment);
}

/** Logs may redact a known public namespace field. Its value is bound to live env + task + image. */
export function parseCompletedBackupOutput(
  message,
  { namespace, requestedAt, observedAt, execution },
) {
  requireBackup(
    typeof message === 'string' && Buffer.byteLength(message) <= maximumMessageBytes,
    'backup-output-unavailable',
  );
  const results = [];
  for (const line of message.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate.startsWith('{')) continue;
    let value;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (record(value) && value.status === 'backed-up') results.push(value);
  }
  requireBackup(results.length === 1, 'backup-marker-unavailable');
  const result = results[0];
  const marker = result.marker;
  requireBackup(
    exactKeys(
      marker,
      [
        'version',
        'id',
        'namespace',
        'createdAt',
        'complete',
        'completedAt',
        'manifestSha256',
        'ciphertext',
      ],
      ['application'],
    ),
    'backup-marker-invalid',
  );
  requireBackup(
    marker.version === 1 &&
      marker.complete === true &&
      matches(backupId, marker.id) &&
      matches(hash, marker.manifestSha256),
    'backup-marker-invalid',
  );
  requireBackup(
    exactKeys(marker.namespace, ['project', 'environment', 'source']),
    'backup-marker-invalid',
  );
  const redactedIdentityFields = [];
  for (const key of Object.keys(namespace)) {
    const actual = marker.namespace[key];
    requireBackup(actual === namespace[key] || actual === redacted, 'backup-namespace-mismatch');
    if (actual === redacted) redactedIdentityFields.push(key);
  }
  if (result.namespaceSha256 !== undefined)
    requireBackup(
      matches(hash, result.namespaceSha256) &&
        result.namespaceSha256 === namespaceSha256(namespace),
      'backup-namespace-mismatch',
    );
  const createdAt = markerTimestamp(marker.createdAt);
  const completedAt = markerTimestamp(marker.completedAt);
  requireBackup(
    createdAt <= completedAt &&
      createdAt >= requestedAt - 60_000 &&
      completedAt <= observedAt + 60_000,
    'backup-marker-stale',
  );
  requireBackup(
    createdAt >= execution.startedAt - 60_000 && completedAt <= execution.finishedAt + 60_000,
    'backup-marker-stale',
  );
  const ciphertext = marker.ciphertext;
  requireBackup(
    exactKeys(ciphertext, ['key', 'byteLength', 'sha256']) &&
      ciphertext.key === `sets/${marker.id}/payload.age` &&
      Number.isSafeInteger(ciphertext.byteLength) &&
      ciphertext.byteLength > 0 &&
      matches(hash, ciphertext.sha256),
    'backup-marker-invalid',
  );
  let application;
  if (marker.application !== undefined) {
    const app = marker.application;
    requireBackup(
      exactKeys(app, ['revision', 'schemaSha256'], ['imageId']) &&
        matches(revision, app.revision) &&
        matches(hash, app.schemaSha256) &&
        (app.imageId === undefined || matches(digest, app.imageId)),
      'backup-marker-invalid',
    );
    application = {
      revision: app.revision,
      schemaSha256: app.schemaSha256,
      ...(app.imageId === undefined ? {} : { imageId: app.imageId }),
    };
  }
  return {
    marker: {
      version: 1,
      id: marker.id,
      namespace: { ...namespace },
      createdAt: marker.createdAt,
      complete: true,
      completedAt: marker.completedAt,
      manifestSha256: marker.manifestSha256,
      ciphertext: {
        key: ciphertext.key,
        byteLength: ciphertext.byteLength,
        sha256: ciphertext.sha256,
      },
      ...(application ? { application } : {}),
    },
    redactedIdentityFields,
    namespaceSha256Verified: result.namespaceSha256 !== undefined,
  };
}
function verifiedTask(list, resourceUuid, taskUuid) {
  requireBackup(Array.isArray(list), 'backup-task-invalid');
  const matches = list.filter((item) => record(item) && item.uuid === taskUuid);
  requireBackup(matches.length === 1, 'backup-task-invalid');
  const task = matches[0];
  requireBackup(
    task.name === backupTaskName && task.command === backupTaskCommand,
    task.command == null ? 'backup-command-unavailable' : 'backup-command-mismatch',
  );
  requireBackup(
    typeof task.enabled === 'boolean' &&
      Number.isSafeInteger(task.timeout) &&
      task.timeout > 0 &&
      task.timeout <= 36_000,
    'backup-task-invalid',
  );
  requireBackup(
    task.container == null || task.container === '' || task.container === resourceUuid,
    'backup-task-invalid',
  );
  return task;
}
function verifiedExecutions(list) {
  requireBackup(Array.isArray(list) && list.length <= 10_000, 'backup-execution-invalid');
  const ids = new Set();
  return list.map((item) => {
    requireBackup(
      record(item) &&
        matches(resourceId, item.uuid) &&
        !ids.has(item.uuid) &&
        states.has(item.status),
      'backup-execution-invalid',
    );
    ids.add(item.uuid);
    return {
      uuid: item.uuid,
      status: item.status,
      createdAt: executionTimestamp(item.created_at),
      startedAt: executionTimestamp(item.started_at),
      finishedAt: executionTimestamp(item.finished_at),
      message: item.message,
    };
  });
}

function historicalBackupIds(executions) {
  const ids = new Set();
  for (const execution of executions) {
    if (
      typeof execution.message !== 'string' ||
      Buffer.byteLength(execution.message) > maximumMessageBytes
    )
      continue;
    for (const line of execution.message.split(/\r?\n/)) {
      let result;
      try {
        result = JSON.parse(line);
      } catch {
        continue;
      }
      if (
        record(result) &&
        result.status === 'backed-up' &&
        record(result.marker) &&
        matches(backupId, result.marker.id)
      )
        ids.add(result.marker.id);
    }
  }
  return ids;
}

/** One POST only. A missing command, completion marker or fresh execution blocks the image change. */
export async function runPreDeploymentBackup(
  { environment, resourceUuid, taskUuid, sourceImageTag },
  { api, now, sleep, deadline, pollIntervalMs },
) {
  requireBackup(
    ['staging', 'production'].includes(environment) &&
      matches(resourceId, resourceUuid) &&
      matches(resourceId, taskUuid) &&
      matches(sourceTag, sourceImageTag),
    'backup-configuration-invalid',
  );
  if (environment === 'staging')
    requireBackup(taskUuid === stagingBackupTaskUuid, 'backup-task-invalid');
  else requireBackup(taskUuid !== stagingBackupTaskUuid, 'backup-task-invalid');
  requireBackup(
    typeof api === 'function' &&
      typeof now === 'function' &&
      typeof sleep === 'function' &&
      Number.isFinite(deadline) &&
      Number.isSafeInteger(pollIntervalMs) &&
      pollIntervalMs > 0,
    'backup-client-invalid',
  );
  requireBackup(Number.isFinite(now()) && deadline > now(), 'backup-timeout');
  const path = `/applications/${resourceUuid}`;
  const tasksPath = `${path}/scheduled-tasks`;
  const executionPath = `${tasksPath}/${taskUuid}/executions`;
  const request = (method, endpoint) =>
    api(method, endpoint, undefined, { backupCredential: true });
  verifiedTask(await request('GET', tasksPath), resourceUuid, taskUuid);
  const namespace = verifyBackupEnvironment(await request('GET', `${path}/envs`), environment);
  const previous = verifiedExecutions(await request('GET', executionPath));
  requireBackup(
    previous.every((item) => terminal.has(item.status) && item.finishedAt !== undefined),
    'backup-already-running',
  );
  const previousIds = new Set(previous.map((item) => item.uuid));
  const previousBackupIds = historicalBackupIds(previous);
  const requestedAt = now();
  await request('POST', `${tasksPath}/${taskUuid}/execute`);
  const maximumPolls = Math.max(1, Math.ceil((deadline - requestedAt) / pollIntervalMs));
  for (let attempt = 0; attempt < maximumPolls && now() < deadline; attempt++) {
    const observedAt = now();
    const current = verifiedExecutions(await request('GET', executionPath)).filter(
      (item) => !previousIds.has(item.uuid),
    );
    requireBackup(current.length <= 1, 'backup-execution-ambiguous');
    const execution = current[0];
    if (execution) {
      requireBackup(
        execution.createdAt !== undefined &&
          execution.createdAt >= requestedAt - 60_000 &&
          execution.createdAt <= observedAt + 60_000 &&
          (execution.startedAt === undefined || execution.startedAt >= requestedAt - 60_000),
        'backup-execution-stale',
      );
      requireBackup(execution.status !== 'failed', 'backup-failed');
      if (execution.status === 'success') {
        requireBackup(
          execution.startedAt !== undefined &&
            execution.finishedAt !== undefined &&
            execution.finishedAt >= execution.startedAt &&
            execution.finishedAt <= observedAt + 60_000,
          'backup-execution-invalid',
        );
        const completed = parseCompletedBackupOutput(execution.message, {
          namespace,
          requestedAt,
          observedAt,
          execution,
        });
        requireBackup(!previousBackupIds.has(completed.marker.id), 'backup-marker-reused');
        verifiedTask(await request('GET', tasksPath), resourceUuid, taskUuid);
        verifyBackupEnvironment(await request('GET', `${path}/envs`), environment);
        return {
          status: 'backed-up',
          taskUuid,
          executionUuid: execution.uuid,
          sourceImageDigest: sourceImageTag.replace('-', ':'),
          ...completed,
        };
      }
    }
    const remaining = deadline - now();
    requireBackup(remaining > 0, 'backup-timeout');
    await sleep(Math.min(pollIntervalMs, remaining));
  }
  throw new CoolifyBackupError('backup-timeout');
}
