/**
 * Compute calendar tenure from an ISO start date (YYYY-MM-DD) to today.
 * Returns null if the date is missing/invalid.
 */
export function computeTenure(startDate, asOf = new Date()) {
  const raw = String(startDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null

  const start = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null

  const end = new Date(asOf)
  end.setHours(0, 0, 0, 0)
  if (end < start) {
    return { years: 0, months: 0, days: 0, totalDays: 0 }
  }

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const totalDays = Math.round((end - start) / 86400000)
  return { years, months, days, totalDays }
}

/** Format a YYYY-MM-DD date for display in the given locale. */
export function formatStartDate(startDate, locale = 'th') {
  const raw = String(startDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const loc = locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'th-TH'
  return d.toLocaleDateString(loc, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
