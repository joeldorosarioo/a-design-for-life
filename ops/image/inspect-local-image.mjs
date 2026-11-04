import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const digest = /^sha256:[a-f0-9]{64}$/;
const sourceRevision = /^(?:[a-f0-9]{40}|draft-[a-z0-9][a-z0-9.-]{0,100})$/;
// Values inherited from the pinned base and the Dockerfile's static runtime defaults.
const allowedEnvironment = new Set([
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'NODE_VERSION=24.22.2',
  'YARN_VERSION=1.22.22',
  'NODE_ENV=production',
  'NEXT_TELEMETRY_DISABLED=1',
  'PORT=3000',
  'HOSTNAME=0.0.0.0',
  'MEDIA_CHECKER_BINARY=/opt/qpdf/bin/qpdf',
]);

export function inspectLocalImage(record, expected) {
  if (!digest.test(expected.imageId) || !sourceRevision.test(expected.revision))
    throw new Error('Expected immutable image identity and honest source revision.');
  if (record?.Id !== expected.imageId) throw new Error('Unexpected local image identity.');
  if (record?.Os !== 'linux' || record?.Architecture !== 'amd64')
    throw new Error('Only the verified linux/amd64 image is supported.');
  if (record?.Config?.User !== '10001:10001') throw new Error('Unexpected runtime user.');
  if (record?.Config?.Labels?.['org.opencontainers.image.revision'] !== expected.revision)
    throw new Error('Unexpected source revision.');
  if (!Array.isArray(record.Config.Env)) throw new Error('Missing environment metadata.');
  const environment = record.Config.Env;
  if (
    new Set(environment).size !== environment.length ||
    environment.some((entry) => !allowedEnvironment.has(entry))
  )
    throw new Error('Runtime configuration must remain outside image metadata.');
  const environmentNames = environment.map((entry) => entry.split('=', 1)[0]).sort();
  if (
    !Array.isArray(record.RootFS?.Layers) ||
    record.RootFS.Layers.length === 0 ||
    record.RootFS.Layers.some((layer) => !digest.test(layer))
  )
    throw new Error('Invalid layer identity.');
  const registryDigests = record.RepoDigests ?? [];
  if (
    !Array.isArray(registryDigests) ||
    registryDigests.some((entry) => !/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(entry))
  )
    throw new Error('Invalid registry manifest identity.');
  return {
    imageId: record.Id,
    registryDigests,
    platform: 'linux/amd64',
    user: record.Config.User,
    revision: expected.revision,
    layers: record.RootFS.Layers.length,
    environmentNames,
  };
}

export function dockerInspectionArguments(reference) {
  if (
    typeof reference !== 'string' ||
    reference.length > 256 ||
    !/^[a-z0-9][a-z0-9./:_@-]*$/.test(reference) ||
    /(?:^|:)latest$/.test(reference)
  )
    throw new Error('Use a safe explicit local tag or immutable digest, never latest.');
  return ['image', 'inspect', '--format', '{{json .}}', reference];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [reference, imageId, revision, ...extra] = process.argv.slice(2);
    if (extra.length || !imageId || !revision) throw new Error('Missing expected image identity.');
    const result = spawnSync('docker', dockerInspectionArguments(reference), {
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
    });
    if (result.error || result.status !== 0) throw new Error('Docker inspection failed.');
    console.log(
      JSON.stringify(inspectLocalImage(JSON.parse(result.stdout), { imageId, revision }), null, 2),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Image inspection failed.');
    process.exitCode = 1;
  }
}
