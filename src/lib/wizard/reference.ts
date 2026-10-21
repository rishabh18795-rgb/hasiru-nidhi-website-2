/** Short, human-friendly reference for a listing application, derived from its id (e.g. HN-3F9A21BC). */
export function applicationReference(propertyId: string): string {
  return `HN-${propertyId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
