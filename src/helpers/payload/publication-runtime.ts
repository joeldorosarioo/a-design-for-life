import 'server-only';
import type { createPublicationCoordinator } from './publication-coordinator';
const key = Symbol.for('a-design-for-life.publication-provider');
type Provider = () => ReturnType<typeof createPublicationCoordinator>;
const composition = globalThis as typeof globalThis & { [key]?: Provider };
export function installPublicationProvider(provider: Provider) {
  composition[key] = provider;
}
export function runtimePublication() {
  const provider = composition[key];
  if (!provider)
    throw new Error('Publication provider must be installed by application composition.');
  return provider();
}
