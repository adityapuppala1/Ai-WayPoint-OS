/** Case- and accent-insensitive matching, so "analisis" finds "Análisis" and "cafe" finds "café". */
export const fold = (s: string): string =>
  s.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/** True when the folded query appears in any of the fields. */
export function matchesQuery(query: string, ...fields: Array<string | undefined>): boolean {
  const q = fold(query.trim());
  return !q || fields.some((f) => f !== undefined && fold(f).includes(q));
}
