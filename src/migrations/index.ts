import * as migration_20261030_003022_initial_base from './20261030_003022_initial_base';
import * as migration_20261030_020021_editorial_models from './20261030_020021_editorial_models';
import * as migration_20261030_020521_structural_uniqueness from './20261030_020521_structural_uniqueness';

export const migrations = [
  {
    up: migration_20261030_003022_initial_base.up,
    down: migration_20261030_003022_initial_base.down,
    name: '20261030_003022_initial_base',
  },
  {
    up: migration_20261030_020021_editorial_models.up,
    down: migration_20261030_020021_editorial_models.down,
    name: '20261030_020021_editorial_models',
  },
  {
    up: migration_20261030_020521_structural_uniqueness.up,
    down: migration_20261030_020521_structural_uniqueness.down,
    name: '20261030_020521_structural_uniqueness',
  },
];
