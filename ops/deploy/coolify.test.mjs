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

const digest = `sha256:${'a'.repeat(64)}`;
const migrationTree = 'b'.repeat(40);
const deploymentUuid = 'deployment123456789012345';
const productionUuid = 'production123456789012345';
const options = () => ({ environment: 'staging', digest, migrationTree });
const environment = () => ({
  APPROVED_MIGRATION_TREE: migrationTree,
  GITHUB_REPOSITORY: 'joeldorosarioo/a-design-for-life',
  GITHUB_REF: 'refs/heads/develop',
  COOLIFY_URL: coolifyOrigin,
  COOLIFY_TOKEN: 'synthetic-read-write-token',
  COOLIFY_DEPLOY_TOKEN: 'synthetic-deploy-only-token',
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
        const custom = await onRequest?.(request, requests.length);
        if (custom !== undefined) return custom;
        let body;
        const pathname = new URL(url).pathname;
        if (pathname.startsWith('/api/v1/applications/')) {
          if (init.method === 'PATCH') {
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

test('requires both configured credentials and permits fallback only when deploy token is absent', async () => {
  for (const token of ['', undefined, 'contains\nnewline'])
    await refuses('token-required', options(), { ...environment(), COOLIFY_TOKEN: token });
  for (const token of ['', null, 'contains space'])
    await refuses('token-required', options(), { ...environment(), COOLIFY_DEPLOY_TOKEN: token });
  const client = fakeApi();
  await deployCoolify(options(), {
    ...client.dependencies,
    env: { ...environment(), COOLIFY_DEPLOY_TOKEN: undefined },
  });
  assert(
    client.requests.every(
      (request) => request.headers.Authorization === `Bearer ${environment().COOLIFY_TOKEN}`,
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
  assert.deepEqual(result, {
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
  const patch = client.requests.find((request) => request.method === 'PATCH');
  assert.deepEqual(JSON.parse(patch.body), { docker_registry_image_tag: digest.replace(':', '-') });
  const post = client.requests.find((request) => request.method === 'POST');
  assert.equal(post.url, `${coolifyOrigin}/api/v1/deploy`);
  assert.deepEqual(JSON.parse(post.body), { uuid: stagingResourceUuid });
  for (const request of client.requests) {
    assert.equal(request.redirect, 'error');
    assert.equal(new URL(request.url).origin, coolifyOrigin);
    assert(request.signal instanceof AbortSignal);
    assert.equal(
      request.headers.Authorization,
      `Bearer ${request.method === 'POST' ? environment().COOLIFY_DEPLOY_TOKEN : environment().COOLIFY_TOKEN}`,
    );
  }
  assert(!JSON.stringify(result).includes('synthetic-'));
});

test('verifies the saved tag before starting a deployment', async () => {
  const client = fakeApi({
    onRequest: (request, index) =>
      index === 3 ? new Response(JSON.stringify(application()), { status: 200 }) : undefined,
  });
  await assert.rejects(
    deployCoolify(options(), client.dependencies),
    (error) => error.code === 'image-tag-mismatch',
  );
  assert(!client.requests.some((request) => request.method === 'POST'));
});

test('rejects deployment responses for a different resource', async () => {
  const client = fakeApi({
    onRequest: (request) =>
      request.method === 'POST'
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
    onRequest: (request, index) =>
      index === 6 ? new Response(JSON.stringify(application()), { status: 200 }) : undefined,
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
      },
    },
  );
  assert.equal(result.environment, 'production');
  assert.equal(result.resourceUuid, productionUuid);
});
