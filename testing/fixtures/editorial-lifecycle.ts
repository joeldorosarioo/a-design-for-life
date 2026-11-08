import sharp from 'sharp';
import { pdfUploadFixture } from './media-uploads';
import type { CollectionSlug, PayloadRequest } from 'payload';
import { createLocalReq } from 'payload';
import { acquireEditorialLease, editorialHead } from '../../src/helpers/payload/editorial-revision';
import { navigationInputSchema } from '../../src/features/site-navigation/contracts/navigation.schema';
import type { Payload } from 'payload';
export function navigationFixture() {
  const data: Record<string, unknown> = {};
  for (const group of ['header', 'footer', 'controls', 'messages'] as const)
    data[group] = Object.fromEntries(
      Object.keys(navigationInputSchema.shape[group].unwrap().unwrap().shape).map((key) => [
        key,
        `Synthetic ${key}`,
      ]),
    );
  return data;
}
export async function observedRequest(collection: CollectionSlug, id: string, req: PayloadRequest) {
  const lease = await acquireEditorialLease(collection, id, req);
  const head = await editorialHead(collection, id, req);
  req.headers = new Headers({
    'x-editorial-revision': head.editorialRevision,
    'x-editorial-lease': lease.token ?? '',
  });
  return req;
}
export async function mediaMetadataFixture(payload: Payload, kind: 'image' | 'pdf' = 'image') {
  if (
    process.env.APP_ENV !== 'test' ||
    !new URL(process.env.DATABASE_URI ?? '').pathname.startsWith('/adfl_test_')
  )
    throw new Error('Metadata fixture requires isolated test DB');
  const editor = (
    await payload.find({ collection: 'users', limit: 1, overrideAccess: true, depth: 0 })
  ).docs[0];
  if (!editor) throw new Error('Real media fixture requires an existing native editor');
  const bytes =
    kind === 'image'
      ? await sharp({ create: { width: 16, height: 16, channels: 3, background: '#28506a' } })
          .png()
          .toBuffer()
      : Buffer.from(pdfUploadFixture());
  return payload.create({
    collection: 'media',
    data: {},
    file: {
      data: bytes,
      size: bytes.length,
      name: `synthetic.${kind === 'image' ? 'png' : 'pdf'}`,
      mimetype: kind === 'image' ? 'image/png' : 'application/pdf',
    },
    req: await createLocalReq({ user: { ...editor, collection: 'users' } }, payload),
    overrideAccess: false,
  });
}
export function casePublicationFixture(mediaId: string) {
  return {
    title: 'Synthetic title',
    summary: 'Synthetic summary',
    slug: `synthetic-${crypto.randomUUID()}`,
    role: 'Synthetic role',
    cover: { media: mediaId, decorative: false, alt: 'Synthetic cover' },
    sections: [
      {
        heading: 'Synthetic section',
        blocks: [
          {
            blockType: 'text' as const,
            content: {
              root: {
                type: 'root',
                version: 1,
                direction: null,
                format: '' as const,
                indent: 0,
                children: [
                  {
                    type: 'paragraph',
                    version: 1,
                    direction: null,
                    format: '' as const,
                    indent: 0,
                    children: [
                      {
                        type: 'text',
                        version: 1,
                        text: 'Synthetic narrative',
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  };
}

import { profileInputSchema } from '../../src/features/professional-profile/contracts/profile.schema';
export function profilePublicationFixture(imageId: string, pdfId: string) {
  const data: Record<string, unknown> = {};
  for (const group of [
    'identity',
    'home',
    'homeProjects',
    'listing',
    'homeAbout',
    'approach',
    'about',
    'contacts',
  ] as const) {
    const value: Record<string, unknown> = {};
    for (const key of Object.keys(profileInputSchema.shape[group].unwrap().unwrap().shape)) {
      if (['portrait', 'deskPhotograph', 'architecturePhotograph'].includes(key))
        value[key] = { media: imageId, decorative: false, alt: `Synthetic ${key}` };
      else if (key === 'trajectory')
        value[key] = [
          {
            period: 'Synthetic period',
            title: 'Synthetic trajectory',
            description: 'Synthetic description',
          },
        ];
      else if (key === 'methods')
        value[key] = [{ title: 'Synthetic method', description: 'Synthetic description' }];
      else value[key] = `Synthetic ${key}`;
    }
    data[group] = value;
  }
  data.contacts = {
    email: 'synthetic@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic',
  };
  data.resume = pdfId;
  return data;
}
