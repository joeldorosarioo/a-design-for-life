const handledContacts = new WeakSet<Event>();
/** Transient event ownership only; no visitor or navigation identifier is generated. */
export function markAnalyticsContact(event: Event): void {
  handledContacts.add(event);
}
export function wasAnalyticsContactHandled(event: Event): boolean {
  return handledContacts.has(event);
}
