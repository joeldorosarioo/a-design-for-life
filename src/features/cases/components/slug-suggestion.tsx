'use client';
import { Button, useField, useFormFields } from '@payloadcms/ui';
import { suggestSlug } from '../lib/suggest-slug';
export function SlugSuggestion({ readOnly }: { readOnly?: boolean }) {
  const title = useFormFields(([fields]) => fields.title?.value as string | undefined);
  const { setValue } = useField<string>({ path: 'slug' });
  return (
    <Button
      type="button"
      buttonStyle="secondary"
      size="small"
      disabled={readOnly || !title || !suggestSlug(title)}
      onClick={() => setValue(suggestSlug(title ?? ''))}
    >
      Sugerir a partir do título
    </Button>
  );
}
