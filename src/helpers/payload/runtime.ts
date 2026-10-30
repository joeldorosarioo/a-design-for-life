import 'server-only';
import type { Payload } from 'payload';
const providerKey = Symbol.for('a-design-for-life.payload-provider');
type Provider = () => Promise<Payload>;
const processComposition = globalThis as typeof globalThis & { [providerKey]?: Provider };
export function installPayloadProvider(provider: Provider) {
  // Instrumentation, Route Handlers and the native admin have independent Next
  // module graphs. Share only this factory. HMR/composition may replace it;
  // documents, users, requests and cached public content are never stored here.
  processComposition[providerKey] = provider;
}
export function runtimePayload() {
  const load = processComposition[providerKey];
  if (!load) throw new Error('Payload provider must be installed by application composition.');
  return load();
}
