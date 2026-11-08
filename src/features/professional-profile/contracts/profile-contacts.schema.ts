import { z } from 'zod';

const email = z.union([z.literal(''), z.email()]);
const linkedin = z.union([
  z.literal(''),
  z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      ['linkedin.com', 'www.linkedin.com'].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  }, 'Informe um endereço HTTPS do LinkedIn.'),
]);

/** Shared semantic boundary for editorial input and confirmed public snapshots. */
export const profileContactsSchema = z.strictObject({
  email: email.nullable(),
  linkedin: linkedin.nullable(),
});
