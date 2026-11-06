import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CoolifyDeploymentError,
  coolifyOrigin,
  deployCoolify,
  imageRepository,
  parseDeploymentArguments,
  stagingResourceUuid,
} from './coolify.mjs';

import { backupTaskCommand, backupTaskName, stagingBackupTaskUuid } from './backup.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const migrationTree = 'b'.repeat(40);
const deploymentUuid = 'deployment123456789012345';
const productionUuid = 'production123456789012345';
const productionTaskUuid = 'productionbackuptask123456';
const executionUuid = 'execution123456789012345';
const options = () => ({ environment: 'staging', digest, migrationTree });
const environment = () => ({
  APPROVED_MIGRATION_TREE: migrationTree,
  GITHUB_REPOSITORY: 'joeldorosarioo/a-design-for-life',
  GITHUB_REF: 'refs/heads/develop',
  COOLIFY_URL: coolifyOrigin,
  COOLIFY_TOKEN: 'synthetic-read-write-token',
  COOLIFY_DEPLOY_TOKEN: 'synthetic-deploy-only-token',
  COOLIFY_BACKUP_TOKEN: 'synthetic-backup-combined-token',
  COOLIFY_BACKUP_TASK_UUID: stagingBackupTaskUuid,
  COOLIFY_RESOURCE_UUID: stagingResourceUuid,
});
const application = (uuid = stagingResourceUuid) => ({
  id: 42,
  uuid,
  build_pack: 'dockerimage',
  docker_registry_image_name: imageRepository,
  docker_registry_image_tag: `sha256-${'c'.repeat(64)}`,
  health_check_enabled: true,
  status: 'running:healthy',
});
function fakeApi({ app = application(), states = ['finished'], finalStatus, onRequest } = {}) {
  const requests = [];
  const sleeps = [];
  let clock = 0;
  let polled = 0;
  let backupExecuted = false;
  let tagUpdated = false;
  let saved = { ...app };
  return {
    requests,
    sleeps,
    dependencies: {
      env: environment(),
      now: () => clock,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        clock += milliseconds;
      },
      timeoutMs: 30,
      pollIntervalMs: 10,
      requestTimeoutMs: 10,
      fetch: async (url, init) => {
        const request = { url, ...init };
        requests.push(request);
        const custom = await onRequest?.(request, requests.length, {
          polled,
          backupExecuted,
          tagUpdated,
        });
        if (custom !== undefined) return custom;
        let body;
        const pathname = new URL(url).pathname;
        if (pathname.endsWith('/scheduled-tasks')) {
          body = [
            {
              uuid: saved.uuid === productionUuid ? productionTaskUuid : stagingBackupTaskUuid,
              name: backupTaskName,
              command: backupTaskCommand,
              enabled: true,
              timeout: 1800,
              container: null,
            },
          ];
        } else if (pathname.endsWith('/envs')) {
          const environment = saved.uuid === productionUuid ? 'production' : 'staging';
          body = [
            { key: 'APP_ENV', value: environment, is_runtime: true, is_preview: false },
            {
              key: 'OPS_BACKUP_SOURCE',
              value: `${environment}-app`,
              is_runtime: true,
              is_preview: false,
            },
          ];
        } else if (pathname.endsWith('/executions')) {
          const environment = saved.uuid === productionUuid ? 'production' : 'staging';
          const timestamp = new Date(0).toISOString();
          body = backupExecuted
            ? [
                {
                  uuid: executionUuid,
                  status: 'success',
                  created_at: timestamp,
                  started_at: timestamp,
                  finished_at: timestamp,
                  message: JSON.stringify({
                    status: 'backed-up',
                    durationMs: 0,
                    marker: {
                      version: 1,
                      id: '3a8a9a5c-7a4d-4c32-96af-c137b08b3581',
                      namespace: {
                        project: 'a-design-for-life',
                        environment,
                        source: `${environment}-app`,
                      },
                      createdAt: timestamp,
                      complete: true,
                      completedAt: timestamp,
                      manifestSha256: 'a'.repeat(64),
                      ciphertext: {
                        key: 'sets/3a8a9a5c-7a4d-4c32-96af-c137b08b3581/payload.age',
                        byteLength: 1234,
                        sha256: 'b'.repeat(64),
                      },
                    },
                  }),
                },
              ]
            : [];
        } else if (pathname.endsWith('/execute')) {
          backupExecuted = true;
          body = { message: 'Execution queued.' };
        } else if (pathname.startsWith('/api/v1/applications/')) {
          if (init.method === 'PATCH') {
            tagUpdated = true;
            saved = { ...saved, ...JSON.parse(init.body) };
            body = { uuid: saved.uuid };
          } else {
            body = { ...saved, ...(polled && finalStatus ? { status: finalStatus(polled) } : {}) };
          }
        } else if (pathname === '/api/v1/deploy') {
          body = { deployments: [{ resource_uuid: saved.uuid, deployment_uuid: deploymentUuid }] };
        } else if (pathname === `/api/v1/deployments/${deploymentUuid}`) {
          body = {
            deployment_uuid: deploymentUuid,
            application_id: String(saved.id),
            status: states[Math.min(polled++, states.length - 1)],
          };
        } else {
          assert.fail('Unexpected API route in offline test.');
        }
        return new Response(JSON.stringify(body), { status: 200 });
      },
    },
  };
}
async function refuses(code, input = options(), env = environment()) {
  const client = fakeApi();
  await assert.rejects(
    deployCoolify(input, { ...client.dependencies, env }),
    (error) => error instanceof CoolifyDeploymentError && error.code === code,
  );
  assert.equal(
    client.requests.length,
    0,
    'Local refusal must happen before any network operation.',
  );
}

test('parses the three explicit options without allowing duplicates or additional arguments', () => {
  assert.deepEqual(
    parseDeploymentArguments([
      '--digest',
      digest,
      '--migration-tree',
      migrationTree,
      '--environment',
      'staging',
    ]),
    options(),
  );
  for (const args of [
    [],
    ['--environment', 'staging', '--digest', digest, '--digest', digest],
    ['--environment', 'staging', '--digest', digest, '--unexpected', migrationTree],
    [
      '--environment',
      'staging',
      '--digest',
      digest,
      '--migration-tree',
      migrationTree,
      '--extra',
      'x',
    ],
  ])
    assert.throws(() => parseDeploymentArguments(args), CoolifyDeploymentError);
});

test('refuses an unapproved migration tree before contacting the panel', async () => {
  await refuses('schema-not-approved', options(), {
    ...environment(),
    APPROVED_MIGRATION_TREE: 'd'.repeat(40),
  });
  await refuses('schema-not-approved', options(), {
    ...environment(),
    APPROVED_MIGRATION_TREE: undefined,
  });
});

test('refuses fork repositories and unsupported branch or pull request refs', async () => {
  await refuses('repository-not-allowed', options(), {
    ...environment(),
    GITHUB_REPOSITORY: 'fork/a-design-for-life',
  });
  for (const ref of ['refs/heads/main', 'refs/pull/1/merge', 'refs/tags/staging', undefined])
    await refuses('branch-not-allowed', options(), { ...environment(), GITHUB_REF: ref });
});

test('binds staging to its known UUID and refuses production from develop or targeting staging', async () => {
  await refuses('resource-environment-mismatch', options(), {
    ...environment(),
    COOLIFY_RESOURCE_UUID: productionUuid,
  });
  const production = { ...options(), environment: 'production' };
  await refuses('branch-not-allowed', production, {
    ...environment(),
    COOLIFY_RESOURCE_UUID: productionUuid,
  });
  await refuses('resource-environment-mismatch', production, {
    ...environment(),
    GITHUB_REF: 'refs/heads/main',
  });
  await refuses('invalid-resource', options(), {
    ...environment(),
    COOLIFY_RESOURCE_UUID: '../another-resource',
  });
});

test('refuses malformed digests, schema identifiers and environments without a request', async () => {
  for (const invalid of [
    { ...options(), digest: `sha256:${'a'.repeat(63)}` },
    { ...options(), digest: 'latest' },
    { ...options(), migrationTree: 'not-a-tree' },
    { ...options(), environment: 'preview' },
  ])
    await refuses('invalid-arguments', invalid);
});

test('accepts only the canonical HTTPS panel without credentials, paths, query or fragments', async () => {
  for (const url of [
    'http://panel.joeldorosarioo.dev',
    'https://panel.joeldorosarioo.dev.attacker.invalid',
    'https://user:password@panel.joeldorosarioo.dev',
    `${coolifyOrigin}/api/v1`,
    `${coolifyOrigin}?token=never-forward`,
    `${coolifyOrigin}#fragment`,
    `${coolifyOrigin}:444`,
    undefined,
  ])
    await refuses('endpoint-not-allowed', options(), { ...environment(), COOLIFY_URL: url });
});

test('requires all configured credentials and permits fallback only when deploy token is absent', async () => {
  for (const token of ['', undefined, 'contains\nnewline'])
    await refuses('token-required', options(), { ...environment(), COOLIFY_TOKEN: token });
  for (const token of ['', null, 'contains space'])
    await refuses('token-required', options(), { ...environment(), COOLIFY_DEPLOY_TOKEN: token });
  for (const token of ['', undefined, null, 'contains space'])
    await refuses('token-required', options(), { ...environment(), COOLIFY_BACKUP_TOKEN: token });
  for (const task of ['', undefined, '../task', productionTaskUuid])
    await refuses('backup-task-invalid', options(), {
      ...environment(),
      COOLIFY_BACKUP_TASK_UUID: task,
    });
  const client = fakeApi();
  await deployCoolify(options(), {
    ...client.dependencies,
    env: { ...environment(), COOLIFY_DEPLOY_TOKEN: undefined },
  });
  assert(
    client.requests.every(
      (request) =>
        request.headers.Authorization ===
        `Bearer ${request.url.includes('/scheduled-tasks') || request.url.endsWith('/envs') ? environment().COOLIFY_BACKUP_TOKEN : environment().COOLIFY_TOKEN}`,
    ),
  );
});

test('validates application UUID, Docker Image type, repository and healthcheck before PATCH', async () => {
  for (const [override, code] of [
    [{ uuid: productionUuid }, 'application-target-mismatch'],
    [{ build_pack: 'dockerfile' }, 'application-type-mismatch'],
    [{ docker_registry_image_name: 'ghcr.io/another/application' }, 'application-image-mismatch'],
    [{ health_check_enabled: false }, 'healthcheck-required'],
  ]) {
    const client = fakeApi({ app: { ...application(), ...override } });
    await assert.rejects(
      deployCoolify(options(), client.dependencies),
      (error) => error.code === code,
    );
    assert.deepEqual(
      client.requests.map((request) => request.method),
      ['GET'],
    );
  }
});

test('updates only the digest field, deploys the exact resource and waits through queued/in_progress', async () => {
  const client = fakeApi({ states: ['queued', 'in_progress', 'finished'] });
  const result = await deployCoolify(options(), client.dependencies);
  const { backup, ...deployed } = result;
  assert.deepEqual(deployed, {
    status: 'deployed',
    environment: 'staging',
    repository: imageRepository,
    digest,
    migrationTree,
    resourceUuid: stagingResourceUuid,
    deploymentUuid,
    applicationStatus: 'running:healthy',
  });
  assert.equal(
    client.requests.filter((request) => request.url.includes('/deployments/')).length,
    3,
  );
  assert.deepEqual(client.sleeps, [10, 10]);
  assert.equal(backup.marker.complete, true);
  assert.equal(backup.executionUuid, executionUuid);
  assert.equal(backup.sourceImageDigest, `sha256:${'c'.repeat(64)}`);
  const patchIndex = client.requests.findIndex((request) => request.method === 'PATCH');
  const executeIndex = client.requests.findIndex((request) => request.url.endsWith('/execute'));
  const verificationIndex = client.requests.findLastIndex((request) =>
    request.url.endsWith('/envs'),
  );
  assert(executeIndex < verificationIndex && verificationIndex < patchIndex);
  const patch = client.requests[patchIndex];
  assert.deepEqual(JSON.parse(patch.body), { docker_registry_image_tag: digest.replace(':', '-') });
  const post = client.requests.find((request) => request.url.endsWith('/deploy'));
  assert.equal(post.url, `${coolifyOrigin}/api/v1/deploy`);
  assert.deepEqual(JSON.parse(post.body), { uuid: stagingResourceUuid });
  for (const request of client.requests) {
    assert.equal(request.redirect, 'error');
    assert.equal(new URL(request.url).origin, coolifyOrigin);
    assert(request.signal instanceof AbortSignal);
    assert.equal(
      request.headers.Authorization,
      `Bearer ${request.url.includes('/scheduled-tasks') || request.url.endsWith('/envs') ? environment().COOLIFY_BACKUP_TOKEN : request.method === 'POST' ? environment().COOLIFY_DEPLOY_TOKEN : environment().COOLIFY_TOKEN}`,
    );
  }
  assert(!JSON.stringify(result).includes('synthetic-'));
});

test('verifies the saved tag before starting a deployment', async () => {
  const client = fakeApi({
    onRequest: (request, _index, state) =>
      state.tagUpdated && request.method === 'GET'
        ? new Response(JSON.stringify(application()), { status: 200 })
        : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'image-tag-mismatch',
  );
  assert(!client.requests.some((request) => request.url.endsWith('/deploy')));
});

test('rejects deployment responses for a different resource', async () => {
  const client = fakeApi({
    onRequest: (request) =>
      request.url.endsWith('/deploy')
        ? new Response(
            JSON.stringify({
              deployments: [{ resource_uuid: productionUuid, deployment_uuid: deploymentUuid }],
            }),
            { status: 200 },
          )
        : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'deployment-target-mismatch',
  );
  assert(!client.requests.some((request) => request.url.includes('/deployments/')));
});

test('requires the deployment identity and fails on failed/cancelled or unknown statuses', async () => {
  for (const [status, code] of [
    ['failed', 'deployment-failed'],
    ['cancelled-by-user', 'deployment-failed'],
    ['upstream-secret', 'deployment-status-invalid'],
  ]) {
    const client = fakeApi({ states: [status] });
    await assert.rejects(
      deployCoolify(options(), client.dependencies),
      (error) => error.code === code && !error.message.includes('upstream-secret'),
    );
  }
  const client = fakeApi({
    onRequest: (request) =>
      request.url.includes('/deployments/')
        ? new Response(
            JSON.stringify({
              deployment_uuid: deploymentUuid,
              application_id: '99',
              status: 'finished',
            }),
            { status: 200 },
          )
        : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'deployment-target-mismatch',
  );
});

test('finished deployment alone is insufficient until the exact app is healthy', async () => {
  const client = fakeApi({
    finalStatus: (polls) => (polls === 1 ? 'running:starting' : 'running:healthy'),
  });
  const result = await deployCoolify(options(), client.dependencies);
  assert.equal(result.status, 'deployed');
  assert.deepEqual(client.sleeps, [10]);
  const unhealthy = fakeApi({ finalStatus: () => 'running:unhealthy' });
  await assert.rejects(
    deployCoolify(options(), unhealthy.dependencies),
    (error) => error.code === 'deployment-timeout',
  );
});

test('bounds queued polling with the injected clock', async () => {
  const client = fakeApi({ states: ['queued'] });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'deployment-timeout',
  );
  assert.equal(
    client.requests.filter((request) => request.url.includes('/deployments/')).length,
    3,
  );
  assert.deepEqual(client.sleeps, [10, 10, 10]);
});

test('does not approve a healthy resource when its configured digest changes during deployment', async () => {
  const client = fakeApi({
    onRequest: (request, _index, state) =>
      state.polled && request.url === `${coolifyOrigin}/api/v1/applications/${stagingResourceUuid}`
        ? new Response(JSON.stringify(application()), { status: 200 })
        : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'image-tag-mismatch',
  );
});

test('sanitizes HTTP/transport failures and does not parse failed response bodies', async () => {
  const secret = 'synthetic-upstream-secret';
  const client = fakeApi({
    onRequest: () => ({
      ok: false,
      redirected: false,
      json: () => assert.fail('Must not parse a failed API body.'),
    }),
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'api-request-failed' && !error.message.includes(secret),
  );
  const transport = fakeApi({
    onRequest: () => {
      throw new Error(secret);
    },
  });
  await assert.rejects(
    deployCoolify(options(), transport.dependencies),
    (error) => error.code === 'api-request-failed' && !error.message.includes(secret),
  );
  const redirect = fakeApi({
    onRequest: () => ({
      ok: true,
      redirected: true,
      json: () => assert.fail('Must not parse redirected API responses.'),
    }),
  });
  await assert.rejects(
    deployCoolify(options(), redirect.dependencies),
    (error) => error.code === 'redirect-rejected',
  );
});

test('supports a separately configured production resource only from main with its approved schema', async () => {
  const client = fakeApi({ app: application(productionUuid) });
  const result = await deployCoolify(
    { ...options(), environment: 'production' },
    {
      ...client.dependencies,
      env: {
        ...environment(),
        GITHUB_REF: 'refs/heads/main',
        COOLIFY_RESOURCE_UUID: productionUuid,
        COOLIFY_BACKUP_TASK_UUID: productionTaskUuid,
      },
    },
  );
  assert.equal(result.environment, 'production');
  assert.equal(result.resourceUuid, productionUuid);
});

test('accepts the real redacted application payload without id and binds the job by explicit application UUID', async () => {
  for (const jobApplication of [
    { application_id: '1', application: { id: 1, uuid: stagingResourceUuid } },
    { application_id: '1', application_uuid: stagingResourceUuid },
  ]) {
    const app = application();
    delete app.id;
    const client = fakeApi({
      app,
      onRequest: (request) =>
        request.url.includes('/deployments/')
          ? new Response(
              JSON.stringify({
                deployment_uuid: deploymentUuid,
                status: 'finished',
                ...jobApplication,
              }),
              { status: 200 },
            )
          : undefined,
    });
    const result = await deployCoolify(options(), client.dependencies);
    assert.equal(result.status, 'deployed');
    assert.equal(result.resourceUuid, stagingResourceUuid);
  }
});

test('rejects every explicit foreign application UUID even when numeric application IDs match', async () => {
  for (const jobApplication of [
    { application: { id: 42, uuid: productionUuid } },
    { application_uuid: productionUuid },
    { application_uuid: stagingResourceUuid, application: { id: 42, uuid: productionUuid } },
    { application_uuid: productionUuid, application: { id: 42, uuid: stagingResourceUuid } },
    { application_uuid: null },
    { application: { id: 42, uuid: null } },
  ]) {
    const client = fakeApi({
      onRequest: (request) =>
        request.url.includes('/deployments/')
          ? new Response(
              JSON.stringify({
                deployment_uuid: deploymentUuid,
                application_id: '42',
                status: 'finished',
                ...jobApplication,
              }),
              { status: 200 },
            )
          : undefined,
    });
    await assert.rejects(
      deployCoolify(options(), client.dependencies),
      (error) => error.code === 'deployment-target-mismatch',
    );
  }
});

test('refuses a job without application UUID when all application payloads omit their numeric id', async () => {
  const app = application();
  delete app.id;
  const client = fakeApi({
    app,
    onRequest: (request) =>
      request.url.includes('/deployments/')
        ? new Response(
            JSON.stringify({
              deployment_uuid: deploymentUuid,
              application_id: '1',
              status: 'finished',
            }),
            { status: 200 },
          )
        : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'deployment-target-mismatch',
  );
});

test('still rejects conflicting numeric identities when the application UUID matches', async () => {
  const client = fakeApi({
    onRequest: (request) =>
      request.url.includes('/deployments/')
        ? new Response(
            JSON.stringify({
              deployment_uuid: deploymentUuid,
              application_id: '99',
              application: { id: 99, uuid: stagingResourceUuid },
              status: 'finished',
            }),
            { status: 200 },
          )
        : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'deployment-target-mismatch',
  );
});

test('refuses an unhealthy or mutable source before starting a backup or changing the image', async () => {
  for (const [changes, code] of [
    [{ status: 'running:unhealthy' }, 'backup-source-unhealthy'],
    [{ status: 'running:starting' }, 'backup-source-unhealthy'],
    [{ docker_registry_image_tag: 'latest' }, 'backup-source-unpinned'],
  ]) {
    const client = fakeApi({ app: { ...application(), ...changes } });
    await assert.rejects(
      deployCoolify(options(), client.dependencies),
      (error) => error.code === code,
    );
    assert.deepEqual(
      client.requests.map((item) => item.method),
      ['GET'],
    );
  }
});

test('does not PATCH an image or deploy when native backup failed or its completion evidence is unavailable', async () => {
  for (const [failure, code] of [
    ['failed', 'backup-failed'],
    ['hidden-message', 'backup-output-unavailable'],
    ['bad-marker', 'backup-marker-invalid'],
    ['missing-command', 'backup-command-unavailable'],
    ['permission-denied', 'api-request-failed'],
  ]) {
    const client = fakeApi({
      onRequest: (request, _index, state) => {
        if (failure === 'missing-command' && request.url.endsWith('/scheduled-tasks'))
          return new Response(
            JSON.stringify([
              { uuid: stagingBackupTaskUuid, name: backupTaskName, enabled: true, timeout: 1800 },
            ]),
            { status: 200 },
          );
        if (failure === 'permission-denied' && request.url.endsWith('/execute'))
          return new Response('must-not-be-exposed', { status: 403 });
        if (!state.backupExecuted || !request.url.endsWith('/executions')) return;
        return new Response(
          JSON.stringify([
            {
              uuid: executionUuid,
              status: failure === 'failed' ? 'failed' : 'success',
              created_at: new Date(0).toISOString(),
              started_at: new Date(0).toISOString(),
              finished_at: new Date(0).toISOString(),
              ...(failure === 'bad-marker'
                ? { message: JSON.stringify({ status: 'backed-up', marker: { complete: false } }) }
                : {}),
            },
          ]),
          { status: 200 },
        );
      },
    });
    await assert.rejects(
      deployCoolify(options(), client.dependencies),
      (error) => error instanceof CoolifyDeploymentError && error.code === code,
    );
    assert(
      !client.requests.some((item) => item.method === 'PATCH' || item.url.endsWith('/deploy')),
    );
    assert(client.requests.filter((item) => item.url.endsWith('/execute')).length <= 1);
  }
});

test('rechecks the same healthy source digest after backup and refuses concurrent source changes before PATCH', async () => {
  for (const [changes, code] of [
    [{ status: 'running:unhealthy' }, 'backup-source-unhealthy'],
    [{ docker_registry_image_tag: `sha256-${'e'.repeat(64)}` }, 'image-tag-mismatch'],
    [{ id: 99 }, 'application-target-mismatch'],
  ]) {
    const client = fakeApi({
      onRequest: (request, _index, state) =>
        state.backupExecuted &&
        request.url === `${coolifyOrigin}/api/v1/applications/${stagingResourceUuid}`
          ? new Response(JSON.stringify({ ...application(), ...changes }), { status: 200 })
          : undefined,
    });
    await assert.rejects(
      deployCoolify(options(), client.dependencies),
      (error) => error.code === code,
    );
    assert(
      !client.requests.some((item) => item.method === 'PATCH' || item.url.endsWith('/deploy')),
    );
  }
});
