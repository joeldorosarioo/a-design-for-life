import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repository = 'joeldorosarioo/a-design-for-life';
const packageApi =
  'https://api.github.com/users/joeldorosarioo/packages/container/a-design-for-life';
const registry = `https://ghcr.io/v2/${repository}`;
const source = `https://github.com/${repository}`;
const sha = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const mediaTypes = new Map([
  ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.oci.image.config.v1+json'],
  [
    'application/vnd.docker.distribution.manifest.v2+json',
    'application/vnd.docker.container.image.v1+json',
  ],
]);
const accept = [...mediaTypes.keys()].join(', ');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

class RegistryError extends Error {
  constructor(code) {
    super(`Registry operation refused: ${code}.`);
    this.name = 'RegistryError';
    this.code = code;
  }
}
function requireValue(condition, code) {
  if (!condition) throw new RegistryError(code);
}
function settings(operation, sourceTree, env) {
  requireValue(env.GITHUB_REPOSITORY === repository, 'repository');
  requireValue(sha.test(sourceTree ?? ''), 'source-tree');
  requireValue(
    env.GITHUB_REF === `refs/heads/${operation === 'mark' ? 'develop' : 'main'}`,
    'branch',
  );
  requireValue(
    typeof env.GH_TOKEN === 'string' && env.GH_TOKEN.length > 0 && !/[\r\n\0]/.test(env.GH_TOKEN),
    'credential',
  );
  requireValue(
    typeof env.GITHUB_ACTOR === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\[bot\])?$/.test(env.GITHUB_ACTOR),
    'actor',
  );
  if (operation === 'mark') requireValue(sha.test(env.GITHUB_SHA ?? ''), 'revision');
  return { operation, sourceTree, env };
}
function documentationSourceTree(selected, cwd) {
  const approvedRevision = selected.env.APPROVED_STAGING_REVISION;
  requireValue(sha.test(selected.env.GITHUB_SHA ?? ''), 'source-comparison');
  const git = (...args) => {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {
      throw new RegistryError('source-comparison');
    }
  };
  requireValue(
    git('rev-parse', 'HEAD').trim() === selected.env.GITHUB_SHA &&
      git('rev-parse', 'HEAD^{tree}').trim() === selected.sourceTree &&
      git('cat-file', '-t', approvedRevision).trim() === 'commit',
    'source-comparison',
  );
  // Disable rename detection so moving executable input under documentation cannot hide its removal.
  const changes = git(
    'diff',
    '--raw',
    '-z',
    '--no-abbrev',
    '--no-renames',
    '--no-ext-diff',
    '--no-textconv',
    '--ignore-submodules=none',
    approvedRevision,
    'HEAD',
    '--',
  ).split('\0');
  requireValue(changes.pop() === '' && changes.length % 2 === 0, 'source-comparison');
  for (let index = 0; index < changes.length; index += 2) {
    const file = changes[index + 1];
    requireValue(
      /^:(?:000000|100644) (?:000000|100644) [a-f0-9]{40} [a-f0-9]{40} [AMD]$/.test(
        changes[index],
      ) &&
        (file === 'README.md' || file === 'AGENTS.md' || file.startsWith('documentation/')),
      'documentation-only',
    );
  }
  requireValue(
    git('status', '--porcelain=v1', '--untracked-files=all').trim() === '',
    'source-comparison',
  );
  const tree = git('rev-parse', `${approvedRevision}^{tree}`).trim();
  requireValue(sha.test(tree), 'source-comparison');
  return tree;
}
async function request(
  fetchImpl,
  url,
  options = {},
  allowedHosts = ['api.github.com', 'ghcr.io'],
  manualConfigBlob = false,
) {
  const target = new URL(url);
  requireValue(
    target.protocol === 'https:' &&
      allowedHosts.includes(target.hostname) &&
      !target.port &&
      !target.username &&
      !target.password &&
      !target.hash,
    'request-target',
  );
  const blobPrefix = `/v2/${repository}/blobs/`;
  requireValue(
    !manualConfigBlob ||
      (target.hostname === 'ghcr.io' &&
        (options.method ?? 'GET') === 'GET' &&
        !target.search &&
        target.pathname.startsWith(blobPrefix) &&
        digestPattern.test(target.pathname.slice(blobPrefix.length))),
    'request-target',
  );
  try {
    return await fetchImpl(target.href, {
      ...options,
      redirect: manualConfigBlob ? 'manual' : 'error',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RegistryError('transport');
  }
}
async function bytes(response, maxBytes) {
  const declared = response.headers.get('content-length');
  if (declared !== null)
    requireValue(/^\d+$/.test(declared) && Number(declared) <= maxBytes, 'response-size');
  requireValue(response.body, 'response-body');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      requireValue(size <= maxBytes, 'response-size');
      chunks.push(Buffer.from(part.value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof RegistryError) throw error;
    throw new RegistryError('response-body');
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}
function json(content) {
  try {
    return JSON.parse(content.toString('utf8'));
  } catch {
    throw new RegistryError('response-json');
  }
}
async function authorize(selected, fetchImpl) {
  const response = await request(fetchImpl, packageApi, {
    headers: {
      Authorization: `Bearer ${selected.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  requireValue(response.status === 200, 'package-access');
  const info = json(await bytes(response, 1024 * 1024));
  requireValue(
    info?.visibility === 'private' &&
      info?.package_type === 'container' &&
      info?.name === 'a-design-for-life',
    'package-private',
  );
  const tokenUrl = new URL('https://ghcr.io/token');
  tokenUrl.searchParams.set('service', 'ghcr.io');
  tokenUrl.searchParams.set(
    'scope',
    `repository:${repository}:${selected.operation === 'mark' ? 'pull,push' : 'pull'}`,
  );
  const exchanged = await request(fetchImpl, tokenUrl.href, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${selected.env.GITHUB_ACTOR}:${selected.env.GH_TOKEN}`).toString('base64')}`,
    },
  });
  requireValue(exchanged.status === 200, 'registry-access');
  const auth = json(await bytes(exchanged, 1024 * 1024));
  const token = auth?.token ?? auth?.access_token;
  requireValue(
    typeof token === 'string' && /^[A-Za-z0-9._~+/=-]+$/.test(token),
    'registry-credential',
  );
  return { Authorization: `Bearer ${token}` };
}
async function manifest(fetchImpl, headers, reference, expectedDigest) {
  const response = await request(fetchImpl, `${registry}/manifests/${reference}`, {
    headers: { ...headers, Accept: accept },
  });
  requireValue(response.status === 200, 'manifest-access');
  const contentType = response.headers.get('content-type');
  const essence = contentType?.split(';')[0].trim().toLowerCase();
  requireValue(mediaTypes.has(essence), 'manifest-type');
  const content = await bytes(response, 2 * 1024 * 1024);
  const digest = hash(content);
  requireValue(
    response.headers.get('docker-content-digest') === digest &&
      (!expectedDigest || digest === expectedDigest),
    'manifest-digest',
  );
  const document = json(content);
  requireValue(
    document?.schemaVersion === 2 && document?.mediaType === essence && !document.manifests,
    'manifest-version',
  );
  requireValue(
    document?.config?.mediaType === mediaTypes.get(essence) &&
      digestPattern.test(document.config.digest ?? '') &&
      Number.isSafeInteger(document.config.size) &&
      document.config.size > 0 &&
      document.config.size <= 8 * 1024 * 1024 &&
      Array.isArray(document.layers) &&
      document.layers.length > 0,
    'image-config-descriptor',
  );
  return { content, contentType, digest, document };
}
async function configResponse(fetchImpl, headers, imageid) {
  const response = await request(
    fetchImpl,
    `${registry}/blobs/${imageid}`,
    { headers },
    ['ghcr.io'],
    true,
  );
  if (![301, 302, 303, 307, 308].includes(response.status)) return response;
  const location = response.headers.get('location');
  await response.body?.cancel().catch(() => {});
  let target;
  try {
    target = new URL(location ?? '');
  } catch {
    throw new RegistryError('config-redirect-target');
  }
  requireValue(
    target.protocol === 'https:' &&
      target.hostname === 'pkg-containers.githubusercontent.com' &&
      !target.username &&
      !target.password &&
      !target.port &&
      !target.hash,
    'config-redirect-target',
  );
  // Only the blob may use its signed CDN URL, once, without registry credentials.
  return request(
    fetchImpl,
    target.href,
    {
      headers: { Accept: 'application/octet-stream' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    },
    ['pkg-containers.githubusercontent.com'],
  );
}
async function identity(fetchImpl, headers, selected, image) {
  const imageid = image.document.config.digest;
  const response = await configResponse(fetchImpl, headers, imageid);
  requireValue(response.status === 200, 'image-config-access');
  const content = await bytes(response, 8 * 1024 * 1024);
  requireValue(
    hash(content) === imageid && content.length === image.document.config.size,
    'image-config-digest',
  );
  const config = json(content);
  const labels = config?.config?.Labels;
  const revision = labels?.['org.opencontainers.image.revision'];
  requireValue(config?.os === 'linux' && config?.architecture === 'amd64', 'image-platform');
  requireValue(
    labels?.['life.adfl.source-tree'] === selected.sourceTree &&
      labels?.['org.opencontainers.image.source'] === source &&
      sha.test(revision ?? ''),
    'image-labels',
  );
  if (selected.operation === 'mark')
    requireValue(revision === selected.env.GITHUB_SHA, 'image-revision');
  return { digest: image.digest, revision, imageid };
}
export async function resolveTestedImage({
  sourceTree,
  env = process.env,
  fetchImpl = globalThis.fetch,
  cwd = process.cwd(),
}) {
  const selected = settings('resolve', sourceTree, env);
  const approvedRevision = env.APPROVED_STAGING_REVISION;
  const approvedDigest = env.APPROVED_IMAGE_DIGEST;
  const documentationOnly = Boolean(approvedRevision || approvedDigest);
  if (documentationOnly) {
    requireValue(
      sha.test(approvedRevision ?? '') && digestPattern.test(approvedDigest ?? ''),
      'approval',
    );
    selected.sourceTree = documentationSourceTree(selected, cwd);
  }
  const headers = await authorize(selected, fetchImpl);
  const image = await manifest(
    fetchImpl,
    headers,
    `staging-tested-tree-${selected.sourceTree}`,
    documentationOnly ? approvedDigest : undefined,
  );
  const result = await identity(fetchImpl, headers, selected, image);
  if (documentationOnly) requireValue(result.revision === approvedRevision, 'image-revision');
  return result;
}
export async function markTestedImage({
  sourceTree,
  digest,
  env = process.env,
  fetchImpl = globalThis.fetch,
}) {
  const selected = settings('mark', sourceTree, env);
  requireValue(digestPattern.test(digest ?? ''), 'digest');
  const headers = await authorize(selected, fetchImpl);
  const image = await manifest(fetchImpl, headers, digest, digest);
  const result = await identity(fetchImpl, headers, selected, image);
  const marker = `staging-tested-tree-${sourceTree}`;
  const written = await request(fetchImpl, `${registry}/manifests/${marker}`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': image.contentType,
    },
    body: image.content,
  });
  requireValue(
    written.status === 201 && written.headers.get('docker-content-digest') === digest,
    'marker-write',
  );
  const readback = await manifest(fetchImpl, headers, marker, digest);
  requireValue(readback.content.equals(image.content), 'marker-readback');
  return result;
}
export async function runCli(
  argv,
  { env = process.env, fetchImpl = globalThis.fetch, emit = console.log } = {},
) {
  const [operation, ...flags] = argv;
  requireValue(['mark', 'resolve'].includes(operation) && flags.length % 2 === 0, 'arguments');
  const args = new Map();
  for (let index = 0; index < flags.length; index += 2) {
    const key = flags[index];
    requireValue(
      ['--source-tree', ...(operation === 'mark' ? ['--digest'] : [])].includes(key) &&
        !args.has(key),
      'arguments',
    );
    args.set(key, flags[index + 1]);
  }
  const result = await (operation === 'mark' ? markTestedImage : resolveTestedImage)({
    sourceTree: args.get('--source-tree'),
    digest: args.get('--digest'),
    env,
    fetchImpl,
  });
  if (env.GITHUB_OUTPUT)
    appendFileSync(
      env.GITHUB_OUTPUT,
      `digest=${result.digest}\nrevision=${result.revision}\nimageid=${result.imageid}\n`,
      { encoding: 'utf8' },
    );
  emit(JSON.stringify(result));
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    console.error(
      `Registry operation failed (${error instanceof RegistryError ? error.code : 'unexpected'}).`,
    );
    process.exitCode = 1;
  }
}
