/**
 * Names in the library — exercises within a folder, folders among siblings —
 * are unique the way a person reads them: trimmed, and ignoring case.
 */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export function nameTaken(name: string, taken: readonly string[]): boolean {
  return taken.some((other) => sameName(name, other));
}

/**
 * The name if it is free, or the first free numbered one: "Name 2", "Name 3"…
 * with the default separator, "Name - 2" with `' - '`.
 */
export function freeName(name: string, taken: readonly string[], separator = ' '): string {
  const base = name.trim();
  if (!nameTaken(base, taken)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}${separator}${n}`;
    if (!nameTaken(candidate, taken)) return candidate;
  }
}

/** A tag as stored: lowercase words joined by hyphens — "String skipping" is "string-skipping". */
export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
