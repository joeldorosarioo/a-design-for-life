import path from 'node:path';
import {
  localDatabaseVolume,
  testImage,
  testResourceNames,
  type Inspection,
  type NetworkInspection,
} from '../setup/test-ownership';

export function localDatabaseResources(env: NodeJS.ProcessEnv, attached = true) {
  const names = testResourceNames(env);
  const containerId = 'c'.repeat(64);
  const networkId = 'd'.repeat(64);
  const labels = {
    'com.docker.compose.project': names.project,
    'life.adfl.purpose': 'shared-local',
    'com.docker.compose.project.working_dir': process.cwd(),
    'com.docker.compose.project.config_files': path.resolve('compose.local.yaml'),
  };
  const container: Inspection = {
    Id: containerId,
    Image: `sha256:${'e'.repeat(64)}`,
    Name: `/${names.container}`,
    State: { Running: true },
    Config: {
      Image: testImage,
      User: '70:70',
      Labels: { ...labels, 'com.docker.compose.service': names.service },
      Env: ['APP_ENV=local', 'LOCAL_DATABASE_ONLY=true'],
    },
    Mounts: [
      {
        Type: 'volume',
        Name: localDatabaseVolume,
        Destination: '/var/lib/postgresql/data',
        RW: true,
      },
    ],
    HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '5432' }] } },
    NetworkSettings: { Networks: attached ? { [names.network]: { NetworkID: networkId } } : {} },
  };
  const network: NetworkInspection = {
    Id: networkId,
    Name: names.network,
    Driver: 'bridge',
    Labels: { ...labels, 'com.docker.compose.network': 'default' },
    Containers: attached ? { [containerId]: {} } : {},
  };
  return { container, network };
}
