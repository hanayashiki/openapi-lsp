export function parseLocalRef(ref: string): string[] | null {
  if (!ref.startsWith("#/")) return null;
  return ref.slice(2).split("/");
}
