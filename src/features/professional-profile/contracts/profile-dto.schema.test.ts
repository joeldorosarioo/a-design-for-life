import { expect, it } from 'vitest';
import { profileDTOSchema } from './profile-dto.schema';

const profile = {
  locale: 'pt',
  identity: { name: null, role: null },
  home: { eyebrow: null, title: null, titleEmphasis: null, description: null, projectsLabel: null },
  listing: { eyebrow: null, title: null, description: null },
  contacts: {
    email: 'synthetic@example.invalid',
    linkedin: 'https://www.linkedin.com/in/synthetic',
  },
  resumeId: null,
  seo: {
    homeTitle: null,
    homeDescription: null,
    listingTitle: null,
    listingDescription: null,
    aboutTitle: null,
    aboutDescription: null,
  },
};

it.each([
  { email: 'javascript:alert(1)' },
  { email: 'synthetic@example.invalid\r\nBcc:other@example.invalid' },
  { email: '<a href="javascript:alert(1)">x</a>' },
  { linkedin: 'javascript:alert(1)' },
  { linkedin: 'data:text/html,<script>alert(1)</script>' },
  { linkedin: 'http://www.linkedin.com/in/synthetic' },
  { linkedin: 'https://linkedin.com.evil.example/in/synthetic' },
  { linkedin: 'https://user:password@www.linkedin.com/in/synthetic' },
])('rejects unsafe confirmed contact data %j', (contact) => {
  expect(
    profileDTOSchema.safeParse({ ...profile, contacts: { ...profile.contacts, ...contact } })
      .success,
  ).toBe(false);
});

it('reads older confirmed snapshots without fetching new editorial values', () => {
  const parsed = profileDTOSchema.parse(profile);
  expect(parsed).toMatchObject({
    identity: { name: null },
    home: { portrait: null },
    homeProjects: { title: null },
    homeAbout: { trajectory: [] },
    approach: { methods: [] },
    about: { title: null, portrait: null, deskPhotograph: null, architecturePhotograph: null },
    seo: { image: null },
  });
});

it('isolates absent trajectory defaults between legacy snapshot reads', () => {
  const first = profileDTOSchema.parse(profile);
  first.homeAbout.trajectory.push({
    readingKey: null,
    period: 'Synthetic period',
    title: 'Synthetic title',
    description: 'Synthetic body',
  });

  expect(profileDTOSchema.parse(profile).homeAbout.trajectory).toEqual([]);
});

it('isolates absent method defaults between legacy snapshot reads', () => {
  const first = profileDTOSchema.parse(profile);
  first.approach.methods.push({
    readingKey: null,
    title: 'Synthetic method',
    description: 'Synthetic body',
  });

  expect(profileDTOSchema.parse(profile).approach.methods).toEqual([]);
});
