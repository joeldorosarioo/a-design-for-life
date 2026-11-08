import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const digest = /^sha256:[a-f0-9]{64}$/;
const sourceRevision = /^(?:[a-f0-9]{40}|draft-[a-z0-9][a-z0-9.-]{0,100})$/;
// Values inherited from the pinned base and the Dockerfile's static runtime defaults.
const allowedEnvironment = new Set([
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'GOSU_VERSION=1.19',
  'LANG=en_US.utf8',
  'PG_MAJOR=17',
  'PG_VERSION=17.11',
  'PG_SHA256=dd27f2b3c59e73ed14aa3324901242bf69a032a6347805f274e6260322d42979',
  'DOCKER_PG_LLVM_DEPS=llvm21-dev \t\tclang21',
  'PGDATA=/var/lib/postgresql/data',
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
  if (record?.Config?.User !== 'appuser') throw new Error('Unexpected runtime user.');
  const { Entrypoint, Cmd, StopSignal } = record.Config;
  if (
    (Entrypoint != null && (!Array.isArray(Entrypoint) || Entrypoint.length !== 0)) ||
    !Array.isArray(Cmd) ||
    Cmd.length !== 2 ||
    Cmd[0] !== 'node' ||
    Cmd[1] !== 'server.js' ||
    StopSignal !== 'SIGTERM'
  )
    throw new Error('Unexpected container startup configuration.');
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
