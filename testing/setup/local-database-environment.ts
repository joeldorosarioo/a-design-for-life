import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { assertLocalDatabase } from '../../src/config/local-database';
import { assertUnlinkedWorkspacePath } from '../../src/config/next-dist';

export const syntheticLocalDatabaseUri =
  'postgres://adfl_test:synthetic-local-test-only@127.0.0.1:5432/a_design_for_life_rebuild';

export function readLocalDatabaseUri({ required = false } = {}) {
  if (!required) {
    const uri = process.env.ADFL_SHARED_DATABASE_URI ?? syntheticLocalDatabaseUri;
    assertLocalDatabase(uri);
    return uri;
  }
  try {
    const file = path.resolve('.env');
    assertUnlinkedWorkspacePath(file);
    const uri = parse(readFileSync(file)).DATABASE_URI;
    assertLocalDatabase(uri);
    return uri;
  } catch {
    throw new Error(
      'Database execution requires the approved local DATABASE_URI in the private .env file.',
    );
  }
}

export function configureSharedDatabaseUri() {
  const uri = readLocalDatabaseUri({ required: true });
  if (process.env.ADFL_SHARED_DATABASE_URI && process.env.ADFL_SHARED_DATABASE_URI !== uri)
    throw new Error(
      'Inherited shared database configuration differs from the private local configuration.',
    );
  process.env.ADFL_SHARED_DATABASE_URI = uri;
  return uri;
}
