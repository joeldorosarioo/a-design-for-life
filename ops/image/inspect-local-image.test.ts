import { describe, expect, it } from 'vitest';
import { dockerInspectionArguments, inspectLocalImage } from './inspect-local-image.mjs';

const imageId = 'sha256:' + 'a'.repeat(64);
const revision = 'draft-e3-local';
const valid = () => ({
  Id: imageId,
  Os: 'linux',
  Architecture: 'amd64',
  RepoDigests: [],
  Config: {
    User: 'appuser',
    Cmd: ['node', 'server.js'],
    StopSignal: 'SIGTERM',
    Labels: { 'org.opencontainers.image.revision': revision },
    Env: ['NODE_ENV=production', 'PORT=3000', 'HOSTNAME=0.0.0.0'],
  },
  RootFS: { Layers: ['sha256:' + 'b'.repeat(64)] },
});

describe('local image inspection', () => {
  it('returns local image identity separately from registry digests without environment values', () => {
    expect(inspectLocalImage(valid(), { imageId, revision })).toEqual({
      imageId,
      registryDigests: [],
      platform: 'linux/amd64',
      user: 'appuser',
      revision,
      layers: 1,
      environmentNames: ['HOSTNAME', 'NODE_ENV', 'PORT'],
    });
  });
  it('rejects a different local image ID', () => {
    expect(() =>
      inspectLocalImage(valid(), { imageId: 'sha256:' + 'c'.repeat(64), revision }),
    ).toThrow();
  });
  it.each(['arm64', '386'])('refuses unsupported architecture %s', (architecture) => {
    expect(() =>
      inspectLocalImage({ ...valid(), Architecture: architecture }, { imageId, revision }),
    ).toThrow();
  });
  it.each(['root', '0', '0:0', 'postgres', '70:70', 'appuser:0', 'unexpected-user'])(
    'refuses a privileged or unexpected runtime identity %s',
    (user) => {
      const record = valid();
      record.Config.User = user;
      expect(() => inspectLocalImage(record, { imageId, revision })).toThrow(
        'Unexpected runtime user',
      );
    },
  );
  it('refuses a different default startup command', () => {
    const record = valid();
    record.Config.Cmd = ['node', 'ops/image/start-local-stack.mjs'];
    expect(() => inspectLocalImage(record, { imageId, revision })).toThrow('startup configuration');
  });
  it('refuses the wrong source revision', () => {
    expect(() => inspectLocalImage(valid(), { imageId, revision: 'a'.repeat(40) })).toThrow();
  });
  it.each([
    'PAYLOAD_SECRET=never-print-this',
    'SITE_ORIGIN=https://example.invalid',
    'NEXT_PUBLIC_GA4_ID=G-EXAMPLE',
    'R2_ACCESS_KEY_ID=never-print-this',
  ])('refuses baked runtime configuration', (entry) => {
    const record = valid();
    record.Config.Env.push(entry);
    expect(() => inspectLocalImage(record, { imageId, revision })).toThrow('Runtime configuration');
  });
  it('preserves immutable registry references when publication eventually exists', () => {
    const record = { ...valid(), RepoDigests: ['registry.invalid/project@' + imageId] };
    expect(inspectLocalImage(record, { imageId, revision }).registryDigests).toEqual(
      record.RepoDigests,
    );
  });
  it('rejects malformed image and source identities', () => {
    expect(() => inspectLocalImage(valid(), { imageId: 'latest', revision })).toThrow();
    expect(() => inspectLocalImage(valid(), { imageId, revision: 'develop' })).toThrow();
  });
});

describe('Docker invocation', () => {
  it('passes a validated reference as one argument without a shell', () => {
    expect(dockerInspectionArguments('adfl:e3-local-draft')).toEqual([
      'image',
      'inspect',
      '--format',
      '{{json .}}',
      'adfl:e3-local-draft',
    ]);
  });
  it.each(['--help', 'image; echo secret', 'image$(whoami)', '', 'adfl:latest'])(
    'refuses unsafe or mutable promotion input %s',
    (reference) => {
      expect(() => dockerInspectionArguments(reference)).toThrow();
    },
  );
});

describe('baked environment defaults', () => {
  it.each([
    ['HOSTNAME', 'staging-origin.example.invalid'],
    ['PORT', 'synthetic-private-marker'],
    ['MEDIA_CHECKER_BINARY', '/private/synthetic-root'],
    ['PATH', '/synthetic/build-tools'],
  ])('refuses unauthorized values even under the expected %s name', (key, value) => {
    const record = valid();
    record.Config.Env = [
      ...record.Config.Env.filter((entry) => !entry.startsWith(`${key}=`)),
      `${key}=${value}`,
    ];
    expect(() => inspectLocalImage(record, { imageId, revision })).toThrow('Runtime configuration');
  });

  it('refuses duplicate allowed names so the effective image environment is unambiguous', () => {
    const record = valid();
    record.Config.Env.push('PORT=3000');
    expect(() => inspectLocalImage(record, { imageId, revision })).toThrow('Runtime configuration');
  });
});
