import { z } from 'zod';
import { contextualLinkFieldsSchema } from './contextual-link.schema';
const element = {
  direction: z.enum(['ltr', 'rtl']).nullable(),
  format: z.literal(''),
  indent: z.literal(0),
  version: z.literal(1),
};
const emphasis = z.number().int().min(0).max(3);
export const richTextLeafSchema = z.strictObject({
  type: z.literal('text'),
  version: z.literal(1),
  text: z.string(),
  detail: z.literal(0),
  format: emphasis,
  mode: z.literal('normal'),
  style: z.literal(''),
});
const lineBreak = z.strictObject({ type: z.literal('linebreak'), version: z.literal(1) });
const link = z.strictObject({
  ...element,
  type: z.literal('link'),
  version: z.literal(3),
  id: z.string().optional(),
  fields: contextualLinkFieldsSchema,
  children: z.array(z.union([richTextLeafSchema, lineBreak])),
});
const paragraph = z.strictObject({
  ...element,
  type: z.literal('paragraph'),
  textFormat: emphasis.optional(),
  textStyle: z.literal('').optional(),
  children: z.array(z.union([richTextLeafSchema, lineBreak, link])),
});
const itemFields = z.strictObject({
  ...element,
  type: z.literal('listitem'),
  checked: z.undefined().optional(),
  indent: z.number().int().min(0),
  value: z.number().int().min(1),
});
const listFields = z.strictObject({
  ...element,
  type: z.literal('list'),
  indent: z.number().int().min(0),
  listType: z.enum(['bullet', 'number']),
  tag: z.enum(['ul', 'ol']),
  start: z.number().int().min(1),
});
// Only the recursive edge is annotated for TypeScript; all node fields come from schemas.
type ListItem = z.infer<typeof itemFields> & {
  children: (
    | z.infer<typeof richTextLeafSchema>
    | z.infer<typeof lineBreak>
    | z.infer<typeof link>
    | z.infer<typeof paragraph>
    | List
  )[];
};
type List = z.infer<typeof listFields> & { children: ListItem[] };
const listItem: z.ZodType<ListItem> = z.lazy(() =>
  itemFields.extend({
    children: z.array(z.union([richTextLeafSchema, lineBreak, link, paragraph, list])),
  }),
);
const list: z.ZodType<List> = z.lazy(() =>
  listFields
    .extend({ children: z.array(listItem) })
    .refine(
      (node) => (node.listType === 'bullet' ? node.tag === 'ul' : node.tag === 'ol'),
      'Tipo de lista incompatível.',
    ),
);
export const richTextSchema = z.strictObject({
  root: z.strictObject({
    ...element,
    type: z.literal('root'),
    children: z.array(z.union([paragraph, list])),
  }),
});
export type RichText = z.infer<typeof richTextSchema>;
