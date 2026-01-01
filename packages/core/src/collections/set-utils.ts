/**
 * Extend a Map with all entries from another iterable of key-value pairs.
 * Mutates the target map in place.
 */
export function extendMap<K, V>(
  target: Map<K, V>,
  source?: Iterable<[K, V]>
): void {
  if (!source) return;

  for (const [k, v] of source) {
    target.set(k, v);
  }
}
