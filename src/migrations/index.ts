import * as migration_20261030_003022_initial_base from './20261030_003022_initial_base';
import * as migration_20261030_020021_editorial_models from './20261030_020021_editorial_models';
import * as migration_20261030_020521_structural_uniqueness from './20261030_020521_structural_uniqueness';
import * as migration_20261030_024431_case_locale_uniqueness from './20261030_024431_case_locale_uniqueness';
import * as migration_20261030_024640_route_locale_slug_uniqueness from './20261030_024640_route_locale_slug_uniqueness';
import * as migration_20261030_030036_global_editorial_copy from './20261030_030036_global_editorial_copy';
import * as migration_20261030_035306_protect_case_identity_references from './20261030_035306_protect_case_identity_references';
import * as migration_20261030_040829_editorial_revision_and_leases from './20261030_040829_editorial_revision_and_leases';
import * as migration_20261030_042607_editorial_snapshot_revision from './20261030_042607_editorial_snapshot_revision';

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
  {
    up: migration_20261030_024431_case_locale_uniqueness.up,
    down: migration_20261030_024431_case_locale_uniqueness.down,
    name: '20261030_024431_case_locale_uniqueness',
  },
  {
    up: migration_20261030_024640_route_locale_slug_uniqueness.up,
    down: migration_20261030_024640_route_locale_slug_uniqueness.down,
    name: '20261030_024640_route_locale_slug_uniqueness',
  },
  {
    up: migration_20261030_030036_global_editorial_copy.up,
    down: migration_20261030_030036_global_editorial_copy.down,
    name: '20261030_030036_global_editorial_copy',
  },
  {
    up: migration_20261030_035306_protect_case_identity_references.up,
    down: migration_20261030_035306_protect_case_identity_references.down,
    name: '20261030_035306_protect_case_identity_references',
  },
  {
    up: migration_20261030_040829_editorial_revision_and_leases.up,
    down: migration_20261030_040829_editorial_revision_and_leases.down,
    name: '20261030_040829_editorial_revision_and_leases',
  },
  {
    up: migration_20261030_042607_editorial_snapshot_revision.up,
    down: migration_20261030_042607_editorial_snapshot_revision.down,
    name: '20261030_042607_editorial_snapshot_revision',
  },
];
