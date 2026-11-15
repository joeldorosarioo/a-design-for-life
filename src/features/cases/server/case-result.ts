import 'server-only';
import { APIError } from 'payload';
export class SlugConflict extends APIError {
  readonly code = 'slug-conflict';
  constructor() {
    super(
      'Este endereço já pertence a outro case neste idioma. Escolha outro slug.',
      409,
      undefined,
      true,
    );
  }
}
