import path from 'node:path';
import { assertLocalDatabase } from '../../src/config/local-database';

export const testImage = 'adfl:local-alpine3.24';
export const localDatabaseVolume = 'a-design-for-life-rebuild-postgres-data';
export type Inspection = {
  Id: string;
  Name: string;
  Image: string;
  State: { Running: boolean };
  Config: { Image: string; User: string; Labels: Record<string, string>; Env: string[] };
  Mounts: { Type: string; Name?: string; Destination: string; RW?: boolean }[];
  HostConfig: {
    PortBindings: Record<string, { HostIp: string; HostPort: string }[]>;
    Tmpfs?: Record<string, string>;
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
  assertLocalDatabase(env.DATABASE_URI);
  const project = 'a-design-for-life-local';
  const service = 'postgres';
  return { project, service, network: `${project}_default`, container: `${project}-${service}-1` };
}

function localLabels(env: NodeJS.ProcessEnv, labels: Record<string, string>) {
  return (
    labels?.['com.docker.compose.project'] === testResourceNames(env).project &&
    labels?.['life.adfl.purpose'] === 'shared-local'
  );
}

export function verifyOwnedTestNetwork(
  env: NodeJS.ProcessEnv,
  network: NetworkInspection,
  containerId?: string,
) {
  assertLocalDatabase(env.DATABASE_URI);
  if (
    !network ||
    !/^[a-f0-9]{64}$/.test(network.Id) ||
    network.Name !== testResourceNames(env).network ||
    network.Driver !== 'bridge' ||
    !localLabels(env, network.Labels) ||
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
  assertLocalDatabase(env.DATABASE_URI);
  verifyOwnedTestNetwork(env, network, container?.Id);
  const names = testResourceNames(env);
  const ports = container?.HostConfig?.PortBindings;
  const binding = ports?.['5432/tcp'];
  const networks = Object.entries(container?.NetworkSettings?.Networks ?? {});
  const members = Object.keys(network.Containers ?? {});
  const storage = container?.Mounts?.[0];
  if (
    !container ||
    !/^[a-f0-9]{64}$/.test(container.Id) ||
    !/^sha256:[a-f0-9]{64}$/.test(container.Image) ||
    !container.State?.Running ||
    container.Name !== `/${names.container}` ||
    container.Config?.Image !== testImage ||
    container.Config.User !== '70:70' ||
    !localLabels(env, container.Config.Labels) ||
    container.Config.Labels['com.docker.compose.service'] !== names.service ||
    !samePath(container.Config.Labels['com.docker.compose.project.working_dir'], process.cwd()) ||
    !samePath(
      container.Config.Labels['com.docker.compose.project.config_files'],
      path.resolve('compose.local.yaml'),
    ) ||
    !['APP_ENV=local', 'LOCAL_DATABASE_ONLY=true'].every((value) =>
      container.Config.Env?.includes(value),
    ) ||
    container.Mounts.length !== 1 ||
    storage?.Type !== 'volume' ||
    storage.Name !== localDatabaseVolume ||
    storage.Destination !== '/var/lib/postgresql/data' ||
    storage.RW !== true ||
    Object.keys(container.HostConfig.Tmpfs ?? {}).length !== 0 ||
    Object.keys(ports ?? {}).length !== 1 ||
    binding?.length !== 1 ||
    binding[0]?.HostIp !== '127.0.0.1' ||
    binding[0]?.HostPort !== '5432' ||
    (attached === true &&
      (networks.length !== 1 ||
        networks[0]?.[0] !== names.network ||
        networks[0]?.[1].NetworkID !== network.Id ||
        members.length !== 1 ||
        members[0] !== container.Id)) ||
    (attached === false && (networks.length !== 0 || members.length !== 0)) ||
    (attached === 'cleanup' &&
      (networks.length > 1 ||
        (networks.length === 1 &&
          (networks[0]?.[0] !== names.network || networks[0]?.[1].NetworkID !== network.Id))))
  )
    throw new Error('Unexpected owned test container identity.');
  return { containerId: container.Id, networkId: network.Id, networkName: network.Name };
}
