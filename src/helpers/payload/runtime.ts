import 'server-only';
import type { Payload } from 'payload';
let load: (() => Promise<Payload>) | undefined;
export function installPayloadProvider(provider: () => Promise<Payload>) {
  load = provider;
}
export function runtimePayload() {
  if (!load) throw new Error('Payload provider must be installed by application composition.');
  return load();
}
