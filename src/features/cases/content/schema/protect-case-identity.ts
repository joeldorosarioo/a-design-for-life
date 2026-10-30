import 'server-only';
import type { PostgresAdapterArgs } from '@payloadcms/db-postgres';
type SchemaHook = NonNullable<PostgresAdapterArgs['beforeSchemaInit']>[number];
// Extend the native raw schema before Drizzle builds tables and migration snapshots.
export const protectCaseIdentitySchema: SchemaHook = ({ adapter, schema }) => {
  for (const [tableName, columnName] of [
    ['case_content', 'case'],
    ['_case_content_v', 'version_case'],
    ['case_routes', 'case'],
  ] as const) {
    const reference = adapter.rawTables[tableName]?.columns[columnName]?.reference;
    if (!reference || reference.table !== 'cases' || reference.name !== 'id')
      throw new Error(`Expected case identity reference: ${tableName}.${columnName}`);
    reference.onDelete = 'restrict';
  }
  return schema;
};
