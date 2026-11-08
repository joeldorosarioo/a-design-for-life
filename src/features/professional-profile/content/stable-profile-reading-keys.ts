import 'server-only';
import { randomUUID } from 'node:crypto';
import { ValidationError, type CollectionBeforeChangeHook } from 'payload';
import type { ProfessionalProfile } from '@/payload-types';

type ReadingRow = { id?: string | null; readingKey?: string | null };
function groups(document: Partial<ProfessionalProfile>) {
  return [
    { path: 'homeAbout.trajectory', rows: document.homeAbout?.trajectory ?? [] },
    { path: 'approach.methods', rows: document.approach?.methods ?? [] },
  ];
}

export const stableProfileReadingKeys: CollectionBeforeChangeHook<ProfessionalProfile> = ({
  data,
  originalDoc,
  req,
  collection,
}) => {
  const previousKeys = new Map<string, string>();
  for (const group of groups(originalDoc ?? {}))
    for (const row of group.rows)
      if (row.id && row.readingKey) previousKeys.set(`${group.path}/${row.id}`, row.readingKey);
  const used = new Set<string>();
  for (const group of groups(data)) {
    for (const [index, row] of (group.rows as ReadingRow[]).entries()) {
      const path = `${group.path}.${index}.readingKey`;
      const previous = row.id ? previousKeys.get(`${group.path}/${row.id}`) : undefined;
      if (previous && row.readingKey && row.readingKey !== previous)
        throw new ValidationError({
          collection: collection.slug,
          req,
          errors: [{ path, message: 'Chave de leitura não pode ser alterada.' }],
        });
      row.readingKey ||= previous || randomUUID();
      if (used.has(row.readingKey))
        throw new ValidationError({
          collection: collection.slug,
          req,
          errors: [{ path, message: 'Chave de leitura repetida neste documento.' }],
        });
      used.add(row.readingKey);
    }
  }
  return data;
};
