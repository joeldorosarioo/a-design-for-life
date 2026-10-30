import { expect, it } from 'vitest';
import type { ProfessionalProfile } from '@/payload-types';
import { mapProfile } from './map-profile';
const document: ProfessionalProfile = {
  id: '433428d4-312b-492f-853a-67601d906a16',
  locale: 'pt',
  _status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  identity: { name: 'Synthetic published fixture', role: 'Synthetic role' },
  home: { title: 'Synthetic Home' },
  listing: { title: 'Synthetic listing' },
  contacts: {
    email: 'synthetic@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic',
  },
  resume: {
    id: 'ddab1d65-bbe3-4a7c-b59a-e43806913d8f',
    createdAt: '',
    updatedAt: '',
    url: 'https://private.example.invalid/object',
    filename: 'private-file.pdf',
  },
};
it('mapeia somente conteúdo público mínimo sem metadata administrativa ou URL privada de recurso', () => {
  const dto = mapProfile(document);
  expect(dto).toMatchObject({
    locale: 'pt',
    identity: { name: document.identity!.name },
    listing: { title: 'Synthetic listing' },
    resumeId: 'ddab1d65-bbe3-4a7c-b59a-e43806913d8f',
  });
  const serialized = JSON.stringify(dto);
  for (const forbidden of [
    '_status',
    'createdAt',
    'updatedAt',
    'private-file',
    'private.example',
    document.id,
  ])
    expect(serialized).not.toContain(forbidden);
});
it('não transforma um draft de Perfil em DTO público', () => {
  expect(
    mapProfile({ ...document, _status: 'draft', identity: { name: 'Private draft text' } }),
  ).toBeUndefined();
});

it('preserves published Home and About groups, row order and public image uses', () => {
  const mediaId = '10000000-0000-4000-8000-000000000001';
  const firstKey = '10000000-0000-4000-8000-000000000002';
  const secondKey = '10000000-0000-4000-8000-000000000003';
  const image = {
    media: {
      id: mediaId,
      createdAt: '',
      updatedAt: '',
      url: 'https://private.example.invalid/portrait',
      filename: 'private-original.jpg',
    },
    decorative: false,
    alt: 'Synthetic portrait',
    caption: 'Synthetic caption',
  };
  const dto = mapProfile({
    ...document,
    home: { ...document.home, portrait: image },
    homeProjects: {
      eyebrow: 'Selected',
      title: 'Synthetic projects',
      description: 'Project description',
    },
    homeAbout: {
      eyebrow: 'About',
      title: 'Synthetic trajectory',
      description: 'Trajectory description',
      aboutLabel: 'Read about',
      trajectory: [
        {
          id: 'native-row-one',
          readingKey: secondKey,
          period: '2025',
          title: 'Second period',
          description: 'First in editorial order',
        },
        {
          id: 'native-row-two',
          readingKey: firstKey,
          period: '2024',
          title: 'First period',
          description: 'Second in editorial order',
        },
      ],
    },
    approach: {
      eyebrow: 'Approach',
      title: 'Synthetic methods',
      description: 'Method description',
      methods: [
        {
          id: 'native-method',
          readingKey: firstKey,
          title: 'Synthetic method',
          description: 'Method body',
        },
      ],
    },
    about: {
      eyebrow: 'About',
      title: 'Synthetic About',
      description: 'About description',
      introductionHeading: 'Introduction',
      introduction: 'Introduction body',
      portrait: image,
      journeyHeading: 'Journey',
      journey: 'Journey body',
      deskPhotograph: image,
      editorialEmphasis: 'Editorial pause',
      approachHeading: 'Approach',
      approach: 'Approach body',
      architecturePhotograph: image,
      inMotionHeading: 'In motion',
      inMotion: 'In motion body',
      closingHeading: 'Closing',
      closing: 'Closing body',
      projectsLabel: 'View projects',
    },
    seo: { homeTitle: 'Synthetic SEO', image },
  });
  const publicImage = {
    mediaId,
    decorative: false,
    alt: 'Synthetic portrait',
    caption: 'Synthetic caption',
  };
  expect(dto).toMatchObject({
    home: { portrait: publicImage },
    homeProjects: {
      eyebrow: 'Selected',
      title: 'Synthetic projects',
      description: 'Project description',
    },
    homeAbout: {
      aboutLabel: 'Read about',
      trajectory: [
        {
          readingKey: secondKey,
          period: '2025',
          title: 'Second period',
          description: 'First in editorial order',
        },
        {
          readingKey: firstKey,
          period: '2024',
          title: 'First period',
          description: 'Second in editorial order',
        },
      ],
    },
    approach: {
      methods: [{ readingKey: firstKey, title: 'Synthetic method', description: 'Method body' }],
    },
    about: {
      title: 'Synthetic About',
      portrait: publicImage,
      deskPhotograph: publicImage,
      architecturePhotograph: publicImage,
      editorialEmphasis: 'Editorial pause',
      inMotion: 'In motion body',
      closing: 'Closing body',
    },
    seo: { image: publicImage },
  });
  for (const forbidden of [
    'native-row',
    'native-method',
    'private.example',
    'private-original',
    'createdAt',
    'updatedAt',
  ])
    expect(JSON.stringify(dto)).not.toContain(forbidden);
});

it('represents missing presentation values explicitly without inventing professional content', () => {
  const dto = mapProfile(document);
  expect(dto).toMatchObject({
    home: { portrait: null },
    homeProjects: { eyebrow: null, title: null, description: null },
    homeAbout: { eyebrow: null, title: null, description: null, trajectory: [], aboutLabel: null },
    approach: { eyebrow: null, title: null, description: null, methods: [] },
    about: {
      title: null,
      introduction: null,
      portrait: null,
      deskPhotograph: null,
      architecturePhotograph: null,
    },
    seo: { image: null },
  });
});
