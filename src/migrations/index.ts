import * as migration_20261030_003022_initial_base from './20261030_003022_initial_base';

export const migrations = [
  {
    up: migration_20261030_003022_initial_base.up,
    down: migration_20261030_003022_initial_base.down,
    name: '20261030_003022_initial_base',
  },
];
