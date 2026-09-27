export interface ListResponse<T> {
  readonly data: readonly T[];
  readonly meta: { readonly count: number };
}

export const toListResponse = <T>(items: readonly T[]): ListResponse<T> => ({
  data: items,
  meta: { count: items.length },
});
