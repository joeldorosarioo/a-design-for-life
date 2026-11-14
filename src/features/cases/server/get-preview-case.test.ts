import { randomUUID } from 'node:crypto';
import type { PayloadRequest } from 'payload';
import { expect, it } from 'vitest';
import { getPreviewCase } from './get-preview-case';

it('retains intrinsic image dimensions through the authenticated draft projection', async () => {
  const media = {
    id: randomUUID(),
    width: 600,
    height: 900,
    url: '/private-native-url',
    filename: 'private-native-file',
    createdAt: '',
    updatedAt: '',
  };
  const contentId = randomUUID();
  const request = {
    user: { collection: 'users' },
    payload: {
      findByID: async ({ depth }: { depth: number }) => ({
        id: contentId,
        case: randomUUID(),
        locale: 'pt',
        createdAt: '',
        updatedAt: '',
        sections: [
          {
            readingKey: randomUUID(),
            blocks: [
              {
                blockType: 'image',
                readingKey: randomUUID(),
                image: { media: depth > 0 ? media : media.id, alt: 'Private portrait' },
              },
            ],
          },
        ],
      }),
    },
  } as unknown as PayloadRequest;
  const result = await getPreviewCase('pt', contentId, request);
  expect(result).toMatchObject({
    ok: true,
    value: {
      sections: [
        {
          blocks: [
            {
              type: 'image',
              image: {
                mediaId: media.id,
                intrinsicSize: { width: 600, height: 900 },
              },
            },
          ],
        },
      ],
    },
  });
  expect(JSON.stringify(result)).not.toContain('private-native');
});
