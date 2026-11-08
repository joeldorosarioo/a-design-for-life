import type { Field } from 'payload';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Payload traverses named groups before field validation. Encode an explicit
// group clear as complete child clears; {} would retain old children on update.
export function encodeNativeGroupClears<T extends Record<string, unknown>>(
  data: T,
  fields: readonly Field[],
): T {
  let result: Record<string, unknown> = { ...data };
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab) {
          const value = result[tab.name];
          if (value === null) result[tab.name] = clearFields(tab.fields);
          else if (record(value)) result[tab.name] = encodeNativeGroupClears(value, tab.fields);
        } else result = encodeNativeGroupClears(result, tab.fields);
      }
      continue;
    }
    if (!('name' in field)) {
      if ('fields' in field) result = encodeNativeGroupClears(result, field.fields);
      continue;
    }
    if (!Object.hasOwn(result, field.name)) continue;
    const value = result[field.name];
    if (field.type === 'group') {
      if (value === null) result[field.name] = clearFields(field.fields);
      else if (record(value)) result[field.name] = encodeNativeGroupClears(value, field.fields);
    } else if (field.type === 'array' && Array.isArray(value)) {
      result[field.name] = value.map((row) =>
        record(row) ? encodeNativeGroupClears(row, field.fields) : row,
      );
    } else if (field.type === 'blocks' && Array.isArray(value)) {
      result[field.name] = value.map((row) => {
        if (!record(row)) return row;
        const block = field.blocks.find((candidate) => candidate.slug === row.blockType);
        return block ? encodeNativeGroupClears(row, block.fields) : row;
      });
    }
  }
  return result as T;
}

function clearFields(fields: readonly Field[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab) result[tab.name] = clearFields(tab.fields);
        else Object.assign(result, clearFields(tab.fields));
      }
    } else if (!('name' in field)) {
      if ('fields' in field) Object.assign(result, clearFields(field.fields));
    } else if (field.type !== 'ui' && field.type !== 'join' && !field.virtual) {
      result[field.name] =
        field.type === 'group'
          ? clearFields(field.fields)
          : field.type === 'checkbox'
            ? false
            : field.type === 'array' || field.type === 'blocks'
              ? []
              : null;
    }
  }
  return result;
}
