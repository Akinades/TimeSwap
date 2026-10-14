/** Strip leading zeros on numeric IDs so "001" and "1" match */
export function normalizeEmployeeId(id) {
  const s = String(id ?? '').trim()
  if (!s) return s
  if (/^\d+$/.test(s)) return String(Number(s))
  return s
}

export function normalizePersonName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
