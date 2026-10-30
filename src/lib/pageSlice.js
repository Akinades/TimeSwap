export const DEFAULT_PAGE_SIZE = 25

export function usePageSlice(items, page, pageSize = DEFAULT_PAGE_SIZE) {
  const total = items?.length || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  const slice = (items || []).slice(start, start + pageSize)
  return { slice, total, totalPages, page: safePage, start, pageSize }
}
