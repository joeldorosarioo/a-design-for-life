import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { markTestedImage, resolveTestedImage, runCli } from './registry.mjs';

const sourceTree = 'a'.repeat(40);
const revision = 'b'.repeat(40);
const mergeRevision = 'c'.repeat(40);
const repository = 'joeldorosarioo/a-design-for-life';
const marker = `staging-tested-tree-${sourceTree}`;
const registryPath = `/v2/${repository}`;
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const asBytes = (value) => Buffer.from(JSON.stringify(value));
const env = (operation, overrides = {}) => ({
  GITHUB_REPOSITORY: repository,
  GITHUB_ACTOR: 'joeldorosarioo',
  GH_TOKEN: 'synthetic-github-credential',
  GITHUB_REF: `refs/heads/${operation === 'mark' ? 'develop' : 'main'}`,
  GITHUB_SHA: operation === 'mark' ? revision : mergeRevision,
  ...overrides,
});
function image(options = {}) {
  const contentType = options.contentType ?? 'application/vnd.oci.image.manifest.v1+json';
  const config = {
    os: 'linux',
    architecture: 'amd64',
    ...options.config,
    config: {
      Labels: {
        'life.adfl.source-tree': sourceTree,
        'org.opencontainers.image.source': `https://github.com/${repository}`,
        'org.opencontainers.image.revision': revision,
        ...options.labels,
      },
    },
  };
  const configBytes = asBytes(config);
  const imageid = hash(configBytes);
  const manifest = {
    schemaVersion: 2,
    mediaType: contentType,
    config: {
      mediaType: contentType.includes('docker')
        ? 'application/vnd.docker.container.image.v1+json'
        : 'application/vnd.oci.image.config.v1+json',
      size: configBytes.length,
      digest: imageid,
    },
    layers: [
      {
        mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
        size: 128,
        digest: `sha256:${'d'.repeat(64)}`,
      },
    ],
    ...options.manifest,
  };
  const manifestBytes = asBytes(manifest);
  return { configBytes, imageid, manifestBytes, digest: hash(manifestBytes), contentType };
}
function fixture(options = {}) {
  const selected = options.image ?? image();
  const calls = [];
  let written = false;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    assert.ok(init.signal instanceof AbortSignal);
    const target = new URL(url);
    const configBlob =
      target.hostname === 'ghcr.io' &&
      target.pathname === `${registryPath}/blobs/${selected.imageid}`;
    if (!configBlob) assert.equal(init.redirect, 'error');
    else assert.ok(['manual', 'error'].includes(init.redirect));
    assert.ok(
      ['api.github.com', 'ghcr.io', 'pkg-containers.githubusercontent.com'].includes(
        target.hostname,
      ),
    );
    const respond = () => {
      if (target.hostname === 'pkg-containers.githubusercontent.com') {
        return new Response(options.cdnBytes ?? selected.configBytes, {
          status: options.cdnStatus ?? 200,
          headers: options.cdnHeaders,
        });
      }
      if (target.hostname === 'api.github.com') {
        assert.equal(target.pathname, '/users/joeldorosarioo/packages/container/a-design-for-life');
        return Response.json(
          options.packageInfo ?? {
            name: 'a-design-for-life',
            package_type: 'container',
            visibility: 'private',
          },
          { status: options.packageStatus ?? 200 },
        );
      }
      if (target.pathname === '/token') return Response.json({ token: 'synthetic-registry-token' });
      if (target.pathname === `${registryPath}/blobs/${selected.imageid}`) {
        if (options.configRedirect)
          return new Response(null, { status: 307, headers: { Location: options.configRedirect } });
        return new Response(options.configBytes ?? selected.configBytes, {
          status: options.configStatus ?? 200,
        });
      }
      if (target.pathname.startsWith(`${registryPath}/manifests/`)) {
        if (init.method === 'PUT') {
          assert.equal(target.pathname, `${registryPath}/manifests/${marker}`);
          assert.deepEqual(Buffer.from(init.body), selected.manifestBytes);
          assert.equal(init.headers['Content-Type'], selected.contentType);
          written = true;
          return new Response(null, {
            status: options.putStatus ?? 201,
            headers: { 'Docker-Content-Digest': options.putDigest ?? selected.digest },
          });
        }
        assert.ok(
          [
            `${registryPath}/manifests/${selected.digest}`,
            `${registryPath}/manifests/${marker}`,
          ].includes(target.pathname),
        );
        const responseImage = written && options.readback ? options.readback : selected;
        return new Response(responseImage.manifestBytes, {
          status: options.manifestStatus ?? 200,
          headers: {
            'Content-Type': responseImage.contentType,
            'Docker-Content-Digest': options.manifestDigest ?? responseImage.digest,
            ...(options.manifestHeaders ?? {}),
          },
        });
      }
      throw new Error('Unexpected fake request.');
    };
    const response = respond();
    // Match native Fetch: redirect:error rejects before exposing a 30x response.
    if (init.redirect === 'error' && response.status >= 300 && response.status < 400)
      throw new TypeError('Fetch rejected a redirect.');
    return response;
  };
  return { selected, calls, fetchImpl };
}

test('resolve reuses the tested digest when main has the same tree and a different merge commit', async () => {
  const f = fixture();
  const result = await resolveTestedImage({
    sourceTree,
    env: env('resolve'),
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(result, { digest: f.selected.digest, revision, imageid: f.selected.imageid });
  assert.notEqual(result.revision, mergeRevision);
  assert.equal(
    f.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );
  const exchange = new URL(f.calls.find(({ url }) => new URL(url).pathname === '/token').url);
  assert.equal(exchange.searchParams.get('scope'), `repository:${repository}:pull`);
});

test('mark copies the exact tested manifest bytes and type, then verifies the digest by readback', async () => {
  const f = fixture();
  const result = await markTestedImage({
    sourceTree,
    digest: f.selected.digest,
    env: env('mark'),
    fetchImpl: f.fetchImpl,
  });
  assert.deepEqual(result, { digest: f.selected.digest, revision, imageid: f.selected.imageid });
  assert.equal(f.calls.filter(({ init }) => init.method === 'PUT').length, 1);
  const exchange = new URL(f.calls.find(({ url }) => new URL(url).pathname === '/token').url);
  assert.equal(exchange.searchParams.get('scope'), `repository:${repository}:pull,push`);
});

test('preserves a Docker v2 manifest without converting it to an OCI index', async () => {
  const f = fixture({
    image: image({ contentType: 'application/vnd.docker.distribution.manifest.v2+json' }),
  });
  await markTestedImage({
    sourceTree,
    digest: f.selected.digest,
    env: env('mark'),
    fetchImpl: f.fetchImpl,
  });
  assert.equal(
    f.calls.find(({ init }) => init.method === 'PUT').init.headers['Content-Type'],
    f.selected.contentType,
  );
});

for (const [description, operation, overrides, expected] of [
  [
    'a different repository',
    'mark',
    { GITHUB_REPOSITORY: 'other/a-design-for-life' },
    /repository/,
  ],
  ['mark on main', 'mark', { GITHUB_REF: 'refs/heads/main' }, /branch/],
  ['resolve on develop', 'resolve', { GITHUB_REF: 'refs/heads/develop' }, /branch/],
  ['pull requests', 'mark', { GITHUB_REF: 'refs/pull/1/merge' }, /branch/],
  ['a missing credential', 'resolve', { GH_TOKEN: '' }, /credential/],
  ['header injection', 'resolve', { GH_TOKEN: 'bad\ncredential' }, /credential/],
  ['an invalid actor', 'resolve', { GITHUB_ACTOR: 'https://outside.example' }, /actor/],
  ['a missing mark revision', 'mark', { GITHUB_SHA: '' }, /revision/],
])
  test(`refuses ${description} before network access`, async () => {
    const f = fixture();
    const run = operation === 'mark' ? markTestedImage : resolveTestedImage;
    await assert.rejects(
      run({
        sourceTree,
        digest: f.selected.digest,
        env: env(operation, overrides),
        fetchImpl: f.fetchImpl,
      }),
      expected,
    );
    assert.equal(f.calls.length, 0);
  });

for (const invalid of ['main', '../main', 'A'.repeat(40), 'a'.repeat(39)])
  test(`refuses an invalid source tree: ${invalid}`, async () => {
    const f = fixture();
    await assert.rejects(
      resolveTestedImage({ sourceTree: invalid, env: env('resolve'), fetchImpl: f.fetchImpl }),
      /source-tree/,
    );
    assert.equal(f.calls.length, 0);
  });

test('requires a private container package before any GHCR access', async () => {
  const f = fixture({
    packageInfo: { name: 'a-design-for-life', package_type: 'container', visibility: 'public' },
  });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    /package-private/,
  );
  assert.equal(f.calls.length, 1);
});

for (const [description, options, expected] of [
  ['the wrong tree', { labels: { 'life.adfl.source-tree': 'e'.repeat(40) } }, /image-labels/],
  [
    'the wrong source repository',
    { labels: { 'org.opencontainers.image.source': 'https://github.com/other/repo' } },
    /image-labels/,
  ],
  [
    'an invalid revision',
    { labels: { 'org.opencontainers.image.revision': 'latest' } },
    /image-labels/,
  ],
  ['the wrong operating system', { config: { os: 'windows' } }, /image-platform/],
  ['the wrong architecture', { config: { architecture: 'arm64' } }, /image-platform/],
  ['a legacy manifest version', { manifest: { schemaVersion: 1 } }, /manifest-version/],
  ['an index instead of a single image', { manifest: { manifests: [] } }, /manifest-version/],
])
  test(`refuses ${description} without writing a marker`, async () => {
    const f = fixture({ image: image(options) });
    await assert.rejects(
      markTestedImage({
        sourceTree,
        digest: f.selected.digest,
        env: env('mark'),
        fetchImpl: f.fetchImpl,
      }),
      expected,
    );
    assert.equal(
      f.calls.some(({ init }) => init.method === 'PUT'),
      false,
    );
  });

test('mark requires the build revision to match the develop workflow commit', async () => {
  const f = fixture({
    image: image({ labels: { 'org.opencontainers.image.revision': mergeRevision } }),
  });
  await assert.rejects(
    markTestedImage({
      sourceTree,
      digest: f.selected.digest,
      env: env('mark'),
      fetchImpl: f.fetchImpl,
    }),
    /image-revision/,
  );
  assert.equal(
    f.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );
});

test('rejects changed config bytes before writing a marker', async () => {
  const f = fixture({ configBytes: asBytes({ privateError: 'synthetic-body-never-logged' }) });
  await assert.rejects(
    markTestedImage({
      sourceTree,
      digest: f.selected.digest,
      env: env('mark'),
      fetchImpl: f.fetchImpl,
    }),
    (error) => {
      assert.match(error.message, /image-config-digest/);
      assert.doesNotMatch(error.message, /synthetic-body/);
      return true;
    },
  );
  assert.equal(
    f.calls.some(({ init }) => init.method === 'PUT'),
    false,
  );
});

test('rejects a registry digest that does not match the manifest bytes', async () => {
  const f = fixture({ manifestDigest: `sha256:${'f'.repeat(64)}` });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    /manifest-digest/,
  );
});

test('rejects a readback that moved to another valid manifest', async () => {
  const f = fixture({
    readback: image({ labels: { 'org.opencontainers.image.revision': mergeRevision } }),
  });
  await assert.rejects(
    markTestedImage({
      sourceTree,
      digest: f.selected.digest,
      env: env('mark'),
      fetchImpl: f.fetchImpl,
    }),
    /manifest-digest/,
  );
});

test('does not accept a failed marker PUT', async () => {
  const f = fixture({ putStatus: 403 });
  await assert.rejects(
    markTestedImage({
      sourceTree,
      digest: f.selected.digest,
      env: env('mark'),
      fetchImpl: f.fetchImpl,
    }),
    /marker-write/,
  );
});

test('redirects and transport errors remain closed and do not expose credentials or response data', async () => {
  const fetchImpl = async (_url, options) => {
    assert.equal(options.redirect, 'error');
    throw new Error(
      'synthetic-github-credential / synthetic-registry-token / private raw response',
    );
  };
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl }),
    (error) => {
      assert.match(error.message, /transport/);
      assert.doesNotMatch(error.message, /synthetic|private raw/);
      return true;
    },
  );
});

test('CLI writes only immutable metadata to GitHub outputs', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'adfl-registry-output-'));
  const output = path.join(directory, 'output');
  const messages = [];
  const f = fixture();
  try {
    await runCli(['resolve', '--source-tree', sourceTree], {
      env: env('resolve', { GITHUB_OUTPUT: output }),
      fetchImpl: f.fetchImpl,
      emit: (value) => messages.push(value),
    });
    assert.equal(
      readFileSync(output, 'utf8'),
      `digest=${f.selected.digest}\nrevision=${revision}\nimageid=${f.selected.imageid}\n`,
    );
    assert.deepEqual(JSON.parse(messages[0]), {
      digest: f.selected.digest,
      revision,
      imageid: f.selected.imageid,
    });
    assert.doesNotMatch(messages.join(''), /synthetic.*credential|token/);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test('CLI refuses unknown, repeated or operation-incompatible options without network access', async () => {
  for (const args of [
    ['deploy', '--source-tree', sourceTree],
    ['resolve', '--source-tree', sourceTree, '--digest', `sha256:${'d'.repeat(64)}`],
    ['resolve', '--source-tree', sourceTree, '--source-tree', sourceTree],
    ['resolve', '--source-tree'],
  ]) {
    const f = fixture();
    await assert.rejects(
      runCli(args, {
        env: env('resolve'),
        fetchImpl: f.fetchImpl,
        emit: () => assert.fail('Unexpected metadata output.'),
      }),
      /arguments/,
    );
    assert.equal(f.calls.length, 0);
  }
});

test('follows one config-blob redirect to the exact CDN without forwarding registry credentials', async () => {
  const location =
    'https://pkg-containers.githubusercontent.com/ghcr1/blobs/config?sv=synthetic-signed-secret';
  const f = fixture({ configRedirect: location });
  const result = await resolveTestedImage({
    sourceTree,
    env: env('resolve'),
    fetchImpl: f.fetchImpl,
  });
  assert.equal(result.imageid, f.selected.imageid);
  const initialBlob = f.calls.find(
    ({ url }) => new URL(url).pathname === `${registryPath}/blobs/${f.selected.imageid}`,
  );
  assert.equal(initialBlob.init.redirect, 'manual');
  assert.equal(initialBlob.init.headers.Authorization, 'Bearer synthetic-registry-token');
  const cdnCalls = f.calls.filter(
    ({ url }) => new URL(url).hostname === 'pkg-containers.githubusercontent.com',
  );
  assert.equal(cdnCalls.length, 1);
  assert.equal(cdnCalls[0].url, location);
  assert.equal(cdnCalls[0].init.credentials, 'omit');
  assert.equal(cdnCalls[0].init.referrerPolicy, 'no-referrer');
  assert.deepEqual(cdnCalls[0].init.headers, { Accept: 'application/octet-stream' });
  assert.doesNotMatch(
    JSON.stringify(cdnCalls[0].init),
    /Authorization|Cookie|synthetic-github-credential|synthetic-registry-token/,
  );
});

for (const location of [
  'http://pkg-containers.githubusercontent.com/config?sv=synthetic-signed-secret',
  'https://outside.example/config?sv=synthetic-signed-secret',
  'https://pkg-containers.githubusercontent.com.outside.example/config?sv=synthetic-signed-secret',
  'https://user@pkg-containers.githubusercontent.com/config?sv=synthetic-signed-secret',
  'https://pkg-containers.githubusercontent.com:444/config?sv=synthetic-signed-secret',
  'https://pkg-containers.githubusercontent.com/config?sv=synthetic-signed-secret#fragment',
])
  test(`refuses an unauthorized config redirect target: ${new URL(location).host}`, async () => {
    const f = fixture({ configRedirect: location });
    await assert.rejects(
      resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
      (error) => {
        assert.match(error.message, /config-redirect-target/);
        assert.doesNotMatch(error.message, /synthetic-signed-secret|https?:|sv=/);
        return true;
      },
    );
    assert.equal(
      f.calls.some(({ url }) => new URL(url).hostname === 'pkg-containers.githubusercontent.com'),
      false,
    );
  });

test('refuses a redirect chain after the single permitted config CDN request', async () => {
  const f = fixture({
    configRedirect: 'https://pkg-containers.githubusercontent.com/first?sv=synthetic-signed-secret',
    cdnStatus: 307,
    cdnHeaders: {
      Location: 'https://pkg-containers.githubusercontent.com/second?sv=synthetic-signed-secret',
    },
  });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    /transport/,
  );
  assert.equal(
    f.calls.filter(({ url }) => new URL(url).hostname === 'pkg-containers.githubusercontent.com')
      .length,
    1,
  );
});

test('verifies CDN config SHA256 before parsing JSON and never exposes the signed URL or bytes', async () => {
  const f = fixture({
    configRedirect:
      'https://pkg-containers.githubusercontent.com/config?sv=synthetic-signed-secret',
    cdnBytes: Buffer.from('not-json-synthetic-private-config'),
  });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    (error) => {
      assert.match(error.message, /image-config-digest/);
      assert.doesNotMatch(error.message, /synthetic|not-json|https?:|sv=/);
      return true;
    },
  );
});

test('caps the config blob at 8 MiB even when the CDN declares a larger response', async () => {
  const f = fixture({
    configRedirect:
      'https://pkg-containers.githubusercontent.com/config?sv=synthetic-signed-secret',
    cdnHeaders: { 'Content-Length': String(8 * 1024 * 1024 + 1) },
  });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    /response-size/,
  );
});

test('API and manifests never follow redirects to the CDN', async () => {
  const f = fixture({
    manifestStatus: 307,
    manifestHeaders: { Location: 'https://pkg-containers.githubusercontent.com/manifest' },
  });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    /transport/,
  );
  assert.equal(
    f.calls.some(({ url }) => new URL(url).hostname === 'pkg-containers.githubusercontent.com'),
    false,
  );
});

test('fake Fetch rejects a config 307 when redirect:error would hide its Location', async () => {
  const f = fixture({ configRedirect: 'https://pkg-containers.githubusercontent.com/config' });
  await assert.rejects(
    f.fetchImpl(`https://ghcr.io${registryPath}/blobs/${f.selected.imageid}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(1000),
    }),
    /Fetch rejected a redirect/,
  );
});

test('API redirects are rejected without requesting their Location', async () => {
  const f = fixture({ packageStatus: 307 });
  await assert.rejects(
    resolveTestedImage({ sourceTree, env: env('resolve'), fetchImpl: f.fetchImpl }),
    /transport/,
  );
  assert.equal(f.calls.length, 1);
});
