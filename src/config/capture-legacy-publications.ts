import 'server-only';
import type { PayloadRequest, SelectType, Where } from 'payload';
import { publicationAdapters } from './publication';
import {
  enqueuePublicationUpdate,
  type PublicationSubject,
} from '@/helpers/payload/publication-updates';
import { requirePublicationTransaction } from '@/helpers/payload/publication-coordinator';

const image = { media: true, decorative: true, alt: true, caption: true } as const;
const heading = { eyebrow: true, title: true, description: true } as const;
const metadata = {
  id: true,
  editorialRevision: true,
  contentRevision: true,
  latestPublicationIntent: true,
} as const;
// This migration boundary reads only fields present by the coordination migration.
// Whole groups/arrays would silently acquire columns from a later runtime schema.
const legacySelect: Record<PublicationSubject['collection'], SelectType> = {
  cases: { ...metadata, internalTitle: true, sortOrder: true, featured: true },
  'case-content': {
    ...metadata,
    case: true,
    locale: true,
    _status: true,
    eyebrow: true,
    title: true,
    titleEmphasis: true,
    summary: true,
    introduction: true,
    slug: true,
    cover: image,
    role: true,
    scope: true,
    contextNote: true,
    sections: {
      readingKey: true,
      presentation: true,
      eyebrow: true,
      heading: true,
      description: true,
      note: true,
      blocks: {
        text: { readingKey: true, eyebrow: true, heading: true, note: true, content: true },
        image: { readingKey: true, image },
        'image-pair': {
          readingKey: true,
          presentation: true,
          first: image,
          second: image,
          firstLabel: true,
          secondLabel: true,
        },
      },
    },
    seo: { title: true, description: true, image },
  },
  'professional-profiles': {
    ...metadata,
    locale: true,
    _status: true,
    identity: { name: true, role: true },
    home: { ...heading, titleEmphasis: true, portrait: image, projectsLabel: true },
    homeProjects: heading,
    listing: heading,
    homeAbout: {
      ...heading,
      aboutLabel: true,
      trajectory: { readingKey: true, period: true, title: true, description: true },
    },
    approach: { ...heading, methods: { readingKey: true, title: true, description: true } },
    about: {
      ...heading,
      introductionHeading: true,
      introduction: true,
      portrait: image,
      journeyHeading: true,
      journey: true,
      deskPhotograph: image,
      editorialEmphasis: true,
      approachHeading: true,
      approach: true,
      architecturePhotograph: image,
      inMotionHeading: true,
      inMotion: true,
      closingHeading: true,
      closing: true,
      projectsLabel: true,
    },
    contacts: { email: true, linkedin: true },
    resume: true,
    seo: {
      homeTitle: true,
      homeDescription: true,
      listingTitle: true,
      listingDescription: true,
      aboutTitle: true,
      aboutDescription: true,
      image,
    },
  },
  'site-navigation': {
    ...metadata,
    locale: true,
    _status: true,
    header: {
      brandLabel: true,
      projectsLabel: true,
      aboutLabel: true,
      resumeLabel: true,
      contactLabel: true,
    },
    footer: {
      ...heading,
      emailLabel: true,
      linkedinLabel: true,
      resumeLabel: true,
      copyright: true,
    },
    controls: {
      homeLabel: true,
      casesLabel: true,
      contentsLabel: true,
      previousSectionLabel: true,
      nextSectionLabel: true,
      openMenuLabel: true,
      closeMenuLabel: true,
      languageLabel: true,
      newTabLabel: true,
      roleLabel: true,
      scopeLabel: true,
    },
    messages: {
      translationUnavailable: true,
      emptyCasesTitle: true,
      emptyCasesDescription: true,
      caseUnavailableTitle: true,
      caseUnavailableDescription: true,
      temporaryFailureTitle: true,
      temporaryFailureDescription: true,
      retryLabel: true,
      notFoundTitle: true,
      notFoundDescription: true,
    },
  },
};
/** Called once by the additive migration, before ordinary editorial writes resume. */
export async function captureLegacyPublications(req: PayloadRequest): Promise<number> {
  await requirePublicationTransaction(req);
  const collections = Object.keys(publicationAdapters) as PublicationSubject['collection'][];
  const eligible: PublicationSubject['collection'][] = [];
  const predicates = new Map<PublicationSubject['collection'], Where>();
  for (const collection of collections) {
    const adapter = publicationAdapters[collection];
    const eligibleWhere = adapter.legacyWhere
      ? await adapter.legacyWhere(req)
      : adapter.shared
        ? {}
        : { _status: { equals: 'published' } };
    const where: Where = { and: [{ latestPublicationIntent: { exists: false } }, eligibleWhere] };
    predicates.set(collection, where);
    const found = await req.payload.db.find({
      collection,
      where,
      select: legacySelect[collection],
      limit: 1,
      req,
    });
    if (found.docs.length) eligible.push(collection);
  }
  // A new database has no eligible publication and needs no invented editor.
  if (!eligible.length) return 0;
  const previous = req.user;
  if (!req.user) {
    const editor = (
      await req.payload.find({ collection: 'users', limit: 1, depth: 0, overrideAccess: true, req })
    ).docs[0];
    if (!editor)
      throw new Error(
        'Legacy publication capture requires an existing editorial account. Provision the authorized editor before retrying this migration.',
      );
    req.user = { ...editor, collection: 'users' };
  }
  let count = 0;
  try {
    for (const collection of eligible) {
      // Native canonical selection deliberately ignores the newest private version.
      const documents = await req.payload.db.find({
        collection,
        where: predicates.get(collection),
        pagination: false,
        limit: 0,
        select: legacySelect[collection],
        req,
      });
      for (const document of documents.docs) {
        const head = (await req.payload.db.findOne({
          collection,
          where: { id: { equals: document.id } },
          select: legacySelect[collection],
          req,
        })) as { latestPublicationIntent?: string | null } | null;
        if (!head || head.latestPublicationIntent) continue;
        // Native transform emits undefined keys for unselected future fields.
        // Preserve their absence at this historical JSON boundary.
        const canonical = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
        const adapter = publicationAdapters[collection];
        if (!adapter.shared) canonical.editorialRevision = canonical.contentRevision;
        const prepared = adapter.prepareLegacy
          ? await adapter.prepareLegacy(canonical, req)
          : await adapter.prepare(canonical, true, req);
        await enqueuePublicationUpdate(
          {
            subject: { collection, id: String(document.id) },
            targetRevision: String(canonical.editorialRevision),
            target: prepared.value,
            dependencies: [...prepared.dependencies, 'legacy-bootstrap'],
          },
          req,
        );
        count++;
      }
    }
    return count;
  } finally {
    req.user = previous;
  }
}
