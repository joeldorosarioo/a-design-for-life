import 'server-only';
import { ValidationError, type CollectionBeforeChangeHook } from 'payload';
import type { CaseContent } from '@/payload-types';
export const rejectSameOriginExternalLinks: CollectionBeforeChangeHook<CaseContent> = ({
  data,
  req,
  collection,
}) => {
  const origin = new URL(req.payload.config.serverURL).origin;
  const errors: { path: string; message: string }[] = [];
  const visit = (input: unknown, path: string) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return;
    const node = input as Record<string, unknown>;
    if (node.type === 'link' && node.fields && typeof node.fields === 'object') {
      const fields = node.fields as Record<string, unknown>;
      if (
        fields.destination === 'external' &&
        typeof fields.url === 'string' &&
        URL.canParse(fields.url) &&
        new URL(fields.url).origin === origin
      )
        errors.push({
          path: `${path}.fields.url`,
          message: 'Use um destino interno tipado para endereços do próprio site.',
        });
    }
    if (Array.isArray(node.children))
      node.children.forEach((child, index) => visit(child, `${path}.children.${index}`));
  };
  for (const [sectionIndex, section] of (data.sections ?? []).entries())
    for (const [blockIndex, block] of (section.blocks ?? []).entries())
      if (block.blockType === 'text')
        visit(block.content?.root, `sections.${sectionIndex}.blocks.${blockIndex}.content.root`);
  if (errors.length) throw new ValidationError({ collection: collection.slug, req, errors });
  return data;
};
