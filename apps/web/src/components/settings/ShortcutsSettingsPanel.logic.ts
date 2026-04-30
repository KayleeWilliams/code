export interface ReferenceSearchItem {
  readonly searchText: string;
}

export function buildReferenceSearchText(parts: ReadonlyArray<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

export function normalizeReferenceSearchQuery(query: string): ReadonlyArray<string> {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function matchesReferenceSearch(searchText: string, query: string): boolean {
  const tokens = normalizeReferenceSearchQuery(query);
  if (tokens.length === 0) return true;
  return tokens.every((token) => searchText.includes(token));
}

export function filterReferenceItems<T extends ReferenceSearchItem>(
  items: ReadonlyArray<T>,
  query: string,
): T[] {
  return items.filter((item) => matchesReferenceSearch(item.searchText, query));
}
