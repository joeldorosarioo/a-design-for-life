import path from 'node:path';
import { assertIsolatedTestEnvironment } from './test-environment';

export const testProjectPrefix = 'adfl-isolated-tests';
export const testService = 'postgres-isolated';
export const testImage =
  'postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b';
export const ownerLabel = 'life.adfl.test-run';
export const purposeLabel = 'life.adfl.purpose';
export type Inspection = {
  Id: string;
  Name: string;
  Config: { Image: string; Labels: Record<string, string>; Env: string[] };
  Mounts?: { Type: string }[];
  HostConfig: {
    Binds?: string[] | null;
    Mounts?: unknown[] | null;
    PortBindings: Record<string, { HostIp: string; HostPort: string }[]>;
    Tmpfs: Record<string, string>;
  };
  NetworkSettings: { Networks: Record<string, { NetworkID: string }> };
};
export type NetworkInspection = {
  Id: string;
  Name: string;
  Driver: string;
  Labels: Record<string, string>;
  Containers: Record<string, unknown>;
};

export function testResourceNames(env: NodeJS.ProcessEnv) {
  assertIsolatedTestEnvironment(env);
  const project = `${testProjectPrefix}-${env.ADFL_TEST_RUN_ID}`;
  return {
    project,
    service: testService,
    network: `${project}_default`,
    container: `${project}-${testService}-1`,
  };
}
function ownedLabels(env: NodeJS.ProcessEnv, labels: Record<string, string>) {
  return (
    labels?.['com.docker.compose.project'] === testResourceNames(env).project &&
    labels?.[ownerLabel] === env.ADFL_TEST_RUN_ID &&
    labels?.[purposeLabel] === 'disposable-test'
  );
}
export function verifyOwnedTestNetwork(
  env: NodeJS.ProcessEnv,
  network: NetworkInspection,
  containerId?: string,
) {
  assertIsolatedTestEnvironment(env);
  if (
    !network ||
    !/^[a-f0-9]{64}$/.test(network.Id) ||
    network.Name !== testResourceNames(env).network ||
    network.Driver !== 'bridge' ||
    !ownedLabels(env, network.Labels) ||
    network.Labels['com.docker.compose.network'] !== 'default' ||
    Object.keys(network.Containers ?? {}).some((id) => id !== containerId)
  )
    throw new Error('Unexpected owned test network identity.');
  return network.Id;
}
function samePath(value: string | undefined, expected: string) {
  if (!value || !path.isAbsolute(value)) return false;
  const normalize = (selected: string) =>
    process.platform === 'win32' ? selected.toLowerCase() : selected;
  return normalize(path.resolve(value)) === normalize(path.resolve(expected));
}
export function verifyOwnedTestResources(
  env: NodeJS.ProcessEnv,
  container: Inspection,
  network: NetworkInspection,
  attached: boolean | 'cleanup' = true,
) {
  assertIsolatedTestEnvironment(env);
  verifyOwnedTestNetwork(env, network, container?.Id);
  const ports = container?.HostConfig?.PortBindings;
  const binding = ports?.['5432/tcp'];
  const networks = Object.entries(container?.NetworkSettings?.Networks ?? {});
  const members = Object.keys(network.Containers ?? {});
  if (
    !container ||
    !/^[a-f0-9]{64}$/.test(container.Id) ||
    container.Name !== `/${testResourceNames(env).container}` ||
    container.Config?.Image !== testImage ||
    !ownedLabels(env, container.Config?.Labels) ||
    container.Config.Labels['com.docker.compose.service'] !== testService ||
    !samePath(container.Config.Labels['com.docker.compose.project.working_dir'], process.cwd()) ||
    !samePath(
      container.Config.Labels['com.docker.compose.project.config_files'],
      path.resolve('compose.test.yaml'),
    ) ||
    (container.HostConfig.Binds?.length ?? 0) !== 0 ||
    (container.HostConfig.Mounts?.length ?? 0) !== 0 ||
    (container.Mounts ?? []).some((mount) => mount.Type !== 'tmpfs') ||
    ![
      'POSTGRES_DB=adfl_test_runner',
      'POSTGRES_USER=adfl_test',
      'POSTGRES_PASSWORD=synthetic-local-test-only',
    ].every((value) => container.Config.Env?.includes(value)) ||
    Object.keys(ports ?? {}).length !== 1 ||
    binding?.length !== 1 ||
    binding[0]?.HostIp !== '127.0.0.1' ||
    binding[0]?.HostPort !== '55434' ||
    !Object.hasOwn(container.HostConfig.Tmpfs ?? {}, '/var/lib/postgresql/data') ||
    (attached === true &&
      (networks.length !== 1 ||
        networks[0]?.[0] !== testResourceNames(env).network ||
        networks[0]?.[1].NetworkID !== network.Id ||
        members.length !== 1 ||
        members[0] !== container.Id)) ||
    (attached === false && (networks.length !== 0 || members.length !== 0))
  )
    throw new Error('Unexpected owned test container identity.');
  if (
    attached === 'cleanup' &&
    (networks.length > 1 ||
      (networks.length === 1 &&
        (networks[0]?.[0] !== testResourceNames(env).network ||
          networks[0]?.[1].NetworkID !== network.Id)))
  )
    throw new Error('Unexpected owned test cleanup attachment.');
  return { containerId: container.Id, networkId: network.Id, networkName: network.Name };
}
export function planOwnedCleanup(
  env: NodeJS.ProcessEnv,
  created: boolean,
  container: Inspection,
  network: NetworkInspection,
  expected?: { containerId: string; networkId: string },
) {
  if (!created) return [];
  const attached = 'cleanup' as const;
  const owned = verifyOwnedTestResources(env, container, network, attached);
  if (
    expected &&
    (expected.containerId !== owned.containerId || expected.networkId !== owned.networkId)
  )
    throw new Error('Previously acquired owned test resource was replaced.');
  return [
    ['container', 'stop', owned.containerId],
    ['container', 'rm', owned.containerId],
    ['network', 'rm', owned.networkId],
  ];
}
