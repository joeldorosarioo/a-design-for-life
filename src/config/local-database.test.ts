import { expect, it } from 'vitest';
import { assertLocalDatabase, matchesLocalDatabase } from './local-database';

const local = 'postgres://fixture:synthetic-only@127.0.0.1:5432/a_design_for_life_rebuild';

it('recognizes only the approved shared local database without fixing private credentials', () => {
  expect(matchesLocalDatabase(local)).toBe(true);
  expect(matchesLocalDatabase(local.replace('fixture:', 'another_role:'))).toBe(true);
  expect(assertLocalDatabase(local).pathname).toBe('/a_design_for_life_rebuild');
});

it.each([
  undefined,
  local.replace('127.0.0.1', 'localhost'),
  local.replace('5432', '55434'),
  local.replace('a_design_for_life_rebuild', 'production'),
  local.replace('127.0.0.1', 'database.invalid'),
  `${local}?options=-csearch_path=other`,
  `${local}#unexpected`,
  local.replace('synthetic-only', ''),
])('refuses a different or ambiguous database target without echoing its value', (value) => {
  expect(matchesLocalDatabase(value)).toBe(false);
  expect(() => assertLocalDatabase(value)).toThrow(
    'Expected the configured shared local PostgreSQL database.',
  );
});
