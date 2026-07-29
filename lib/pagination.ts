/** Shared cursor pagination (LLD §1.5). */
export type PageParams = {
  cursor?: string;
  limit?: number; // default 20, max 100
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export function normalizePageParams(params: PageParams = {}): {
  cursor: string | undefined;
  limit: number;
} {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  return { cursor: params.cursor, limit };
}
