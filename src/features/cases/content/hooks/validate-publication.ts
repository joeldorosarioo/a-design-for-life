import 'server-only';
import {
  publicationGuard,
  requireImage,
  requireText,
  type PublicationErrors,
} from '@/helpers/payload/publication-validation';
import type { CaseContent } from '@/payload-types';
function hasTextContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasTextContent);
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  if (node.type === 'text') return typeof node.text === 'string' && node.text.trim().length > 0;
  return hasTextContent(node.children);
}
function links(value: unknown, path: string, errors: PublicationErrors) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => links(item, `${path}.${index}`, errors));
    return;
  }
  const node = value as Record<string, unknown>;
  if (node.type === 'link') {
    const fields = node.fields as Record<string, unknown> | undefined;
    const active =
      fields?.destination === 'external'
        ? 'url'
        : fields?.destination === 'page'
          ? 'page'
          : fields?.destination === 'case'
            ? 'case'
            : undefined;
    if (active) requireText(errors, fields?.[active], `${path}.fields.${active}`);
  }
  for (const [key, item] of Object.entries(node)) links(item, `${path}.${key}`, errors);
}
export const validateCasePublication = publicationGuard((raw) => {
  const data = raw as unknown as CaseContent;
  const errors: PublicationErrors = [];
  for (const field of ['title', 'summary', 'role'] as const)
    requireText(errors, data[field], field);
  requireText(errors, data.slug, 'slug');
  if ((data.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) || (data.slug?.length ?? 0) > 80)
    errors.push({
      path: 'slug',
      message: 'Use letras minúsculas, números e hífens, até 80 caracteres.',
    });
  requireImage(errors, data.cover, 'cover');
  if (!(data.sections ?? []).some((section) => section.blocks?.length))
    errors.push({ path: 'sections', message: 'Adicione ao menos um bloco de conteúdo.' });
  data.sections?.forEach((section, index) =>
    section.blocks?.forEach((block, blockIndex) => {
      const path = `sections.${index}.blocks.${blockIndex}`;
      if (block.blockType === 'image') requireImage(errors, block.image, `${path}.image`);
      if (block.blockType === 'image-pair') {
        requireImage(errors, block.first, `${path}.first`);
        requireImage(errors, block.second, `${path}.second`);
      }
      if (block.blockType === 'text') {
        if (!hasTextContent(block.content?.root))
          errors.push({ path: `${path}.content`, message: 'Preencha o texto antes de publicar.' });
        links(block.content, `${path}.content`, errors);
      }
    }),
  );
  if (data.seo?.image?.media) requireImage(errors, data.seo.image, 'seo.image');
  return errors;
});
