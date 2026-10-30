import { z } from 'zod';
const safeURL = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password;
}, 'Use um endereço HTTP(S) ou e-mail sem credenciais.');
const common = { linkType: z.literal('custom'), newTab: z.boolean().optional() };
const typedLinkFieldsSchema = z.discriminatedUnion('destination', [
  z.strictObject({ ...common, destination: z.literal('external'), url: safeURL.optional() }),
  z.strictObject({
    ...common,
    destination: z.literal('page'),
    page: z.enum(['home', 'cases', 'about']).optional(),
  }),
  z.strictObject({ ...common, destination: z.literal('case'), case: z.uuid().optional() }),
  z.strictObject({ ...common, destination: z.literal('resume') }),
  z.strictObject({ ...common, destination: z.literal('contact') }),
]);
// Native drawers serialize empty/undefined inactive fields. They carry no destination.
function normalizeNativeFields(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const fields = { ...input } as Record<string, unknown>;
  for (const key of ['url', 'page', 'case', 'doc'])
    if (fields[key] === undefined || fields[key] === null || fields[key] === '') delete fields[key];
  // Pasting a safe external URL in the native LinkPlugin uses its native custom shape.
  if (fields.destination === undefined && fields.linkType === 'custom')
    fields.destination = 'external';
  for (const key of ['url', 'page', 'case']) {
    const active =
      fields.destination === 'external'
        ? 'url'
        : fields.destination === 'page'
          ? 'page'
          : fields.destination === 'case'
            ? 'case'
            : undefined;
    if (key !== active) delete fields[key];
  }
  return fields;
}
export const contextualLinkFieldsSchema = z.preprocess(
  normalizeNativeFields,
  typedLinkFieldsSchema,
);
export type ContextualLink = z.infer<typeof contextualLinkFieldsSchema>;
