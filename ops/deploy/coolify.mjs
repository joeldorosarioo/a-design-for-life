import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CoolifyBackupError, runPreDeploymentBackup, stagingBackupTaskUuid } from './backup.mjs';

export const coolifyOrigin = 'https://panel.joeldorosarioo.dev';
export const imageRepository = 'ghcr.io/joeldorosarioo/a-design-for-life';
export const stagingResourceUuid = '1tiveqtdwa1kxsjfhtugcjdp';
const githubRepository = 'joeldorosarioo/a-design-for-life';
const uuid = /^[a-zA-Z0-9]{12,64}$/;
const sha = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export class CoolifyDeploymentError extends Error {
  constructor(code) {
    super(`Coolify deployment refused or incomplete (${code}).`);
    this.name = 'CoolifyDeploymentError';
    this.code = code;
  }
}
function requireDeployment(condition, code) {
  if (!condition) throw new CoolifyDeploymentError(code);
}
export function parseDeploymentArguments(args) {
  requireDeployment(Array.isArray(args) && args.length === 6, 'invalid-arguments');
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    requireDeployment(
      ['--environment', '--digest', '--migration-tree'].includes(key) && !values.has(key),
      'invalid-arguments',
    );
    values.set(key, args[index + 1]);
  }
  return {
    environment: values.get('--environment'),
    digest: values.get('--digest'),
    migrationTree: values.get('--migration-tree'),
  };
}
function configuration(input, env) {
  requireDeployment(
    input &&
      ['staging', 'production'].includes(input.environment) &&
      digestPattern.test(input.digest ?? '') &&
      sha.test(input.migrationTree ?? ''),
    'invalid-arguments',
  );
  // An image may be deployed only after the operator approved its exact schema.
  // This client never migrates a database or upgrades this environment variable.
  requireDeployment(
    sha.test(env.APPROVED_MIGRATION_TREE ?? '') &&
      input.migrationTree === env.APPROVED_MIGRATION_TREE,
    'schema-not-approved',
  );
  requireDeployment(env.GITHUB_REPOSITORY === githubRepository, 'repository-not-allowed');
  const ref = input.environment === 'staging' ? 'refs/heads/develop' : 'refs/heads/main';
  requireDeployment(env.GITHUB_REF === ref, 'branch-not-allowed');
  const resourceUuid = env.COOLIFY_RESOURCE_UUID;
  requireDeployment(
    typeof resourceUuid === 'string' && uuid.test(resourceUuid),
    'invalid-resource',
  );
  requireDeployment(
    input.environment === 'staging'
      ? resourceUuid === stagingResourceUuid
      : resourceUuid !== stagingResourceUuid,
    'resource-environment-mismatch',
  );
  requireDeployment(
    env.COOLIFY_URL === coolifyOrigin || env.COOLIFY_URL === `${coolifyOrigin}/`,
    'endpoint-not-allowed',
  );
  const endpoint = new URL(env.COOLIFY_URL);
  requireDeployment(
    endpoint.protocol === 'https:' &&
      endpoint.origin === coolifyOrigin &&
      endpoint.pathname === '/' &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.search &&
      !endpoint.hash,
    'endpoint-not-allowed',
  );
  const token = env.COOLIFY_TOKEN;
  // Preserve the existing image-configuration and deployment credentials.
  // Backups use a separate resource-scoped Read/Sensitive/Write/Deploy token.
  const deployToken = env.COOLIFY_DEPLOY_TOKEN === undefined ? token : env.COOLIFY_DEPLOY_TOKEN;
  const backupToken = env.COOLIFY_BACKUP_TOKEN;
  for (const credential of [token, deployToken, backupToken])
    requireDeployment(
      typeof credential === 'string' &&
        credential.length > 0 &&
        !/[\s\x00-\x1f\x7f]/.test(credential),
      'token-required',
    );
  const backupTaskUuid = env.COOLIFY_BACKUP_TASK_UUID;
  requireDeployment(
    typeof backupTaskUuid === 'string' &&
      uuid.test(backupTaskUuid) &&
      (input.environment === 'staging'
        ? backupTaskUuid === stagingBackupTaskUuid
        : backupTaskUuid !== stagingBackupTaskUuid),
    'backup-task-invalid',
  );
  return {
    ...input,
    resourceUuid,
    token,
    deployToken,
    backupToken,
    backupTaskUuid,
    tag: input.digest.replace(':', '-'),
  };
}
function optionalNumericId(value, code) {
  if (value === undefined) return undefined;
  requireDeployment(
    ['string', 'number'].includes(typeof value) && /^(?:0|[1-9][0-9]*)$/.test(String(value)),
    code,
  );
  return String(value);
}
function consistentApplicationId(expected, observed) {
  requireDeployment(
    expected === undefined || observed === undefined || expected === observed,
    'application-target-mismatch',
  );
  return expected ?? observed;
}
function deploymentApplicationIdentity(state, selected, applicationId) {
  const explicitUuids = [];
  if (Object.hasOwn(state, 'application_uuid')) explicitUuids.push(state.application_uuid);
  if (state.application && Object.hasOwn(state.application, 'uuid'))
    explicitUuids.push(state.application.uuid);
  // A redacted application response may omit its numeric id. Any supplied UUID
  // must still match, even when an older payload has matching numeric ids.
  requireDeployment(
    explicitUuids.every((value) => value === selected.resourceUuid),
    'deployment-target-mismatch',
  );
  const jobId = optionalNumericId(state.application_id, 'deployment-target-mismatch');
  const nestedId = optionalNumericId(state.application?.id, 'deployment-target-mismatch');
  const numericIds = [applicationId, jobId, nestedId].filter((value) => value !== undefined);
  requireDeployment(new Set(numericIds).size <= 1, 'deployment-target-mismatch');
  requireDeployment(
    explicitUuids.length > 0 || (applicationId !== undefined && jobId === applicationId),
    'deployment-target-mismatch',
  );
}
function applicationIdentity(application, selected, expectedTag) {
  requireDeployment(
    application && application.uuid === selected.resourceUuid,
    'application-target-mismatch',
  );
  const id = optionalNumericId(application.id, 'application-target-mismatch');
  requireDeployment(application.build_pack === 'dockerimage', 'application-type-mismatch');
  requireDeployment(
    application.docker_registry_image_name === imageRepository,
    'application-image-mismatch',
  );
  requireDeployment(application.health_check_enabled === true, 'healthcheck-required');
  if (expectedTag !== undefined)
    requireDeployment(application.docker_registry_image_tag === expectedTag, 'image-tag-mismatch');
  return { id, status: application.status, tag: application.docker_registry_image_tag };
}

/** Calls only the canonical panel API; injected dependencies make tests entirely offline. */
export async function deployCoolify(
  input,
  {
    env = process.env,
    fetch: fetchImpl = globalThis.fetch,
    sleep = delay,
    now = Date.now,
    timeoutMs = 600_000,
    pollIntervalMs = 5_000,
    requestTimeoutMs = 15_000,
  } = {},
) {
  const selected = configuration(input, env);
  requireDeployment(
    typeof fetchImpl === 'function' &&
      typeof sleep === 'function' &&
      typeof now === 'function' &&
      [timeoutMs, pollIntervalMs, requestTimeoutMs].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ),
    'invalid-client-options',
  );
  const started = now();
  requireDeployment(Number.isFinite(started), 'invalid-clock');
  const deadline = started + timeoutMs;
  async function api(method, endpoint, body, { backupCredential = false } = {}) {
    requireDeployment(now() < deadline, 'deployment-timeout');
    try {
      const response = await fetchImpl(`${coolifyOrigin}/api/v1${endpoint}`, {
        method,
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${backupCredential ? selected.backupToken : method === 'POST' && endpoint === '/deploy' ? selected.deployToken : selected.token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, deadline - now()))),
      });
      requireDeployment(!response.redirected, 'redirect-rejected');
      requireDeployment(response.ok === true, 'api-request-failed');
      return await response.json();
    } catch (error) {
      if (error instanceof CoolifyDeploymentError) throw error;
      // Never propagate upstream errors, response bodies, environment values or logs.
      throw new CoolifyDeploymentError('api-request-failed');
    }
  }
  const applicationPath = `/applications/${selected.resourceUuid}`;
  const original = applicationIdentity(await api('GET', applicationPath), selected);
  requireDeployment(original.status === 'running:healthy', 'backup-source-unhealthy');
  requireDeployment(/^sha256-[a-f0-9]{64}$/.test(original.tag ?? ''), 'backup-source-unpinned');
  let backup;
  try {
    backup = await runPreDeploymentBackup(
      {
        environment: selected.environment,
        resourceUuid: selected.resourceUuid,
        taskUuid: selected.backupTaskUuid,
        sourceImageTag: original.tag,
      },
      { api, now, sleep, deadline, pollIntervalMs },
    );
  } catch (error) {
    if (error instanceof CoolifyBackupError) throw new CoolifyDeploymentError(error.code);
    throw error;
  }
  // The backup must describe the same healthy, immutable source that is replaced.
  const backedUp = applicationIdentity(await api('GET', applicationPath), selected, original.tag);
  consistentApplicationId(original.id, backedUp.id);
  requireDeployment(backedUp.status === 'running:healthy', 'backup-source-unhealthy');
  await api('PATCH', applicationPath, { docker_registry_image_tag: selected.tag });
  const saved = applicationIdentity(await api('GET', applicationPath), selected, selected.tag);
  const applicationId = consistentApplicationId(original.id, saved.id);
  const deployment = await api('POST', '/deploy', { uuid: selected.resourceUuid });
  requireDeployment(
    Array.isArray(deployment?.deployments) && deployment.deployments.length === 1,
    'deployment-response-invalid',
  );
  const queued = deployment.deployments[0];
  requireDeployment(
    queued.resource_uuid === selected.resourceUuid &&
      typeof queued.deployment_uuid === 'string' &&
      uuid.test(queued.deployment_uuid),
    'deployment-target-mismatch',
  );
  const deploymentUuid = queued.deployment_uuid;
  const maximumPolls = Math.max(1, Math.ceil(timeoutMs / pollIntervalMs));
  for (let attempt = 0; attempt < maximumPolls && now() < deadline; attempt++) {
    const state = await api('GET', `/deployments/${deploymentUuid}`);
    requireDeployment(state?.deployment_uuid === deploymentUuid, 'deployment-target-mismatch');
    deploymentApplicationIdentity(state, selected, applicationId);
    if (state.docker_registry_image_tag != null && state.docker_registry_image_tag !== '')
      requireDeployment(state.docker_registry_image_tag === selected.tag, 'image-tag-mismatch');
    requireDeployment(
      ['queued', 'in_progress', 'finished'].includes(state.status),
      ['failed', 'cancelled-by-user'].includes(state.status)
        ? 'deployment-failed'
        : 'deployment-status-invalid',
    );
    if (state.status === 'finished') {
      const current = applicationIdentity(
        await api('GET', applicationPath),
        selected,
        selected.tag,
      );
      consistentApplicationId(applicationId, current.id);
      if (current.status === 'running:healthy')
        return {
          status: 'deployed',
          environment: selected.environment,
          repository: imageRepository,
          digest: selected.digest,
          migrationTree: selected.migrationTree,
          resourceUuid: selected.resourceUuid,
          deploymentUuid,
          applicationStatus: current.status,
          backup,
        };
    }
    const remaining = deadline - now();
    requireDeployment(remaining > 0, 'deployment-timeout');
    await sleep(Math.min(pollIntervalMs, remaining));
  }
  throw new CoolifyDeploymentError('deployment-timeout');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void Promise.resolve()
    .then(() => deployCoolify(parseDeploymentArguments(process.argv.slice(2))))
    .then(
      (result) => console.log(JSON.stringify(result)),
      (error) => {
        const code = error instanceof CoolifyDeploymentError ? error.code : 'operation-failed';
        console.error(`Coolify deployment refused or incomplete (${code}).`);
        process.exitCode = 1;
      },
    );
}
