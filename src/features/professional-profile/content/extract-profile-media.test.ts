import { expect, it } from 'vitest';
import { extractProfileMedia } from './extract-profile-media';

const homeId = 'ba53e178-456a-437b-a2c1-771ce6b6b0af';
const portraitId = 'e7fda410-76ba-466a-910f-01662e4a840c';
const deskId = '2cad5dcb-15ba-4f2e-b210-40df0b8723fe';
const architectureId = '0555b54d-a759-46a1-b82e-f3caee35534b';
const seoId = '3a7f8848-b305-47dd-8781-368c8ee21e3a';
const resumeId = 'ddab1d65-bbe3-4a7c-b59a-e43806913d8f';

it('extracts the approved profile image slots and localized PDF resume', () => {
  expect(
    extractProfileMedia({
      home: { portrait: { media: homeId } },
      about: {
        portrait: { media: { id: portraitId, filename: 'synthetic.png' } },
        deskPhotograph: { media: deskId },
        architecturePhotograph: { media: architectureId },
      },
      seo: { image: { media: seoId } },
      resume: { id: resumeId, filename: 'synthetic.pdf' },
    }),
  ).toEqual([
    { mediaId: homeId, kind: 'image' },
    { mediaId: portraitId, kind: 'image' },
    { mediaId: deskId, kind: 'image' },
    { mediaId: architectureId, kind: 'image' },
    { mediaId: seoId, kind: 'image' },
    { mediaId: resumeId, kind: 'pdf' },
  ]);
});

it('canonicalizes and deduplicates images while preserving a conflicting PDF use for validation', () => {
  expect(
    extractProfileMedia({
      home: { portrait: { media: homeId.toUpperCase() } },
      about: { portrait: { media: { id: homeId } }, deskPhotograph: { media: deskId } },
      seo: { image: { media: deskId.toUpperCase() } },
      resume: homeId,
    }),
  ).toEqual([
    { mediaId: homeId, kind: 'image' },
    { mediaId: deskId, kind: 'image' },
    { mediaId: homeId, kind: 'pdf' },
  ]);
});

it('does not invent references for incomplete profile draft slots', () => {
  expect(
    extractProfileMedia({
      home: { portrait: { media: '' } },
      about: { portrait: {}, deskPhotograph: null, architecturePhotograph: { media: null } },
      seo: null,
      resume: '',
    }),
  ).toEqual([]);
  expect(extractProfileMedia({})).toEqual([]);
  expect(extractProfileMedia(null)).toEqual([]);
  expect(extractProfileMedia(undefined)).toEqual([]);
});

it('ignores lookalike media outside the approved profile slots', () => {
  expect(
    extractProfileMedia({
      media: homeId,
      identity: { id: portraitId, portrait: { media: homeId } },
      homeAbout: { trajectory: [{ media: deskId }] },
      approach: { methods: [{ image: { media: architectureId } }] },
      contacts: { resume: resumeId },
      home: { description: homeId, image: { media: 'not-an-approved-image-slot' } },
      about: { image: { media: 'not-an-approved-image-slot' } },
      seo: { title: seoId },
    }),
  ).toEqual([]);
});

it.each([
  'not-a-uuid',
  ' ba53e178-456a-437b-a2c1-771ce6b6b0af ',
  0,
  false,
  [[]],
  {},
  { id: null },
  { id: 'not-a-uuid' },
  { id: 12 },
])('rejects a malformed nonempty PDF relationship %j at resume', (resume) => {
  expect(() => extractProfileMedia({ resume })).toThrow(/resume/);
});

it.each([
  [{ home: { portrait: { media: 'invalid' } } }, /home\.portrait\.media/],
  [{ about: { portrait: { media: 'invalid' } } }, /about\.portrait\.media/],
  [{ about: { deskPhotograph: { media: 'invalid' } } }, /about\.deskPhotograph\.media/],
  [
    { about: { architecturePhotograph: { media: 'invalid' } } },
    /about\.architecturePhotograph\.media/,
  ],
  [{ seo: { image: { media: 'invalid' } } }, /seo\.image\.media/],
])('reports the failing image relationship in the profile %j', (document, path) => {
  expect(() => extractProfileMedia(document)).toThrow(path);
});

it.each([
  [{ home: 0 }, /home/],
  [{ home: { portrait: homeId } }, /home\.portrait/],
  [{ about: [] }, /about/],
  [{ about: { deskPhotograph: 0 } }, /about\.deskPhotograph/],
  [{ seo: 'invalid' }, /seo/],
])('does not silently ignore a malformed approved profile container %j', (document, path) => {
  expect(() => extractProfileMedia(document)).toThrow(path);
});
