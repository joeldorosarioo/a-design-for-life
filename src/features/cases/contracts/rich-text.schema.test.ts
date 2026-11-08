import { expect, it } from 'vitest';
import { createHeadlessEditor } from '@payloadcms/richtext-lexical/lexical/headless';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  INSERT_LINE_BREAK_COMMAND,
} from '@payloadcms/richtext-lexical/lexical';
import { registerRichText } from '@payloadcms/richtext-lexical/lexical/rich-text';
import {
  $createListItemNode,
  $createListNode,
  ListItemNode,
  ListNode,
} from '@payloadcms/richtext-lexical/lexical/list';
import { richTextSchema } from './rich-text.schema';
it('aceita quebra suave produzida pelo comando nativo do Lexical', () => {
  const editor = createHeadlessEditor({
    namespace: 'synthetic-linebreak',
    onError: (error) => {
      throw error;
    },
  });
  const unregister = registerRichText(editor);
  editor.update(
    () => {
      const paragraph = $createParagraphNode().append($createTextNode('Synthetic first line'));
      $getRoot().append(paragraph);
      paragraph.selectEnd();
      editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
    },
    { discrete: true },
  );
  const serialized = editor.getEditorState().toJSON();
  expect(JSON.stringify(serialized)).toContain('linebreak');
  expect(richTextSchema.safeParse(serialized).error?.issues ?? []).toEqual([]);
  unregister();
});
it('aceita lista aninhada serializada pelos nós nativos sem liberar estilos livres', () => {
  const editor = createHeadlessEditor({
    namespace: 'synthetic-list',
    nodes: [ListNode, ListItemNode],
    onError: (error) => {
      throw error;
    },
  });
  editor.update(
    () => {
      const nested = $createListNode('number').append(
        $createListItemNode().append($createTextNode('Synthetic nested')),
      );
      $getRoot().append(
        $createListNode('bullet').append(
          $createListItemNode().append($createTextNode('Synthetic top')),
          $createListItemNode().append(nested),
        ),
      );
    },
    { discrete: true },
  );
  const serialized = editor.getEditorState().toJSON();
  expect(JSON.stringify(serialized)).toContain('"indent":1');
  expect(richTextSchema.safeParse(serialized).error?.issues ?? []).toEqual([]);
});
