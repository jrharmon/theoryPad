/**
 * The object without its undefined entries.
 *
 * `exactOptionalPropertyTypes` will not take `{ tempo: undefined }` for an
 * optional `tempo`, so each optional value is spread in on its own:
 * `...(x ? { x } : {})`. That is fine once and noise where three or four of
 * them stack up — this says the same thing in one place.
 */
export function definedProps<T extends object>(source: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]?: Exclude<T[K], undefined> };
}
