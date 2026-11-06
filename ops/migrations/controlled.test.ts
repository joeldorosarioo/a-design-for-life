import { expect, it } from 'vitest';
import { planControlledMigration } from './controlled';

const predecessor = [
  '20261030_003022_initial_base',
  '20261030_020021_editorial_models',
  '20261030_020521_structural_uniqueness',
  '20261030_024431_case_locale_uniqueness',
  '20261030_024640_route_locale_slug_uniqueness',
  '20261030_030036_global_editorial_copy',
  '20261030_035306_protect_case_identity_references',
  '20261030_040829_editorial_revision_and_leases',
  '20261030_042607_editorial_snapshot_revision',
  '20261030_093430_private_media_manifests',
  '20261030_124550_publication_coordination',
  '20261030_190345_e2_editorial_presentation_fields',
  '20261030_201024_e2_reading_position_adjusted',
  '20261031_011109_e2_case_card_copy',
  '20261103_095414_e2_cover_presentation_and_return_copy',
  '20261104_012603_publication_retry_metadata',
].map((name) => ({ name, batch: 1 }));

it('recognizes the reviewed predecessor and the already-current native history', () => {
  expect(planControlledMigration(predecessor)).toBe('pending');
  expect(
    planControlledMigration([
      { name: '20261106_035830_cms_user_profile', batch: 2 },
      ...predecessor,
    ]),
  ).toBe('already-current');
});

it.each([
  ['empty', []],
  ['older predecessor', predecessor.slice(0, -1)],
  ['gapped', predecessor.filter((_, index) => index !== 2)],
  ['duplicate', [...predecessor, predecessor[0]]],
  ['unknown', [...predecessor, { name: 'unknown_migration', batch: 2 }]],
  ['development', [...predecessor, { name: 'dev', batch: -1 }]],
])('refuses %s history before operational effects', (_name, ledger) => {
  expect(() => planControlledMigration(ledger)).toThrow(/history/i);
});
