const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0'),
)
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0'),
)

function splitTime(value) {
  if (!value || value === '—') return { h: '', m: '' }
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return { h: '', m: '' }
  return {
    h: match[1].padStart(2, '0'),
    m: match[2],
  }
}

/**
 * 24-hour time picker (HH:mm) — avoids browser 12-hour AM/PM UI.
 * @param {boolean} [fullWidth] — stretch hour/minute selects (e.g. modal forms)
 */
export default function TimeInput24({
  value,
  onChange,
  className = '',
  fullWidth = false,
}) {
  const { h, m } = splitTime(value)
  const stretch =
    fullWidth || /\bw-full\b/.test(className) || /\bflex-1\b/.test(className)
  const selectCls = stretch
    ? 'min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2.5 text-sm outline-none focus:border-teal-500'
    : 'w-[3rem] rounded-lg border border-slate-300 px-1 py-2 text-sm outline-none focus:border-teal-500'

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <select
        value={h}
        onChange={(e) => {
          const nextH = e.target.value
          if (!nextH) {
            onChange('')
            return
          }
          onChange(`${nextH}:${m || '00'}`)
        }}
        className={selectCls}
        aria-label="ชั่วโมง"
      >
        <option value="">--</option>
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="shrink-0 text-sm font-medium text-slate-500">:</span>
      <select
        value={m}
        onChange={(e) => {
          const nextM = e.target.value
          if (!nextM) {
            onChange('')
            return
          }
          onChange(`${h || '00'}:${nextM}`)
        }}
        className={selectCls}
        aria-label="นาที"
      >
        <option value="">--</option>
        {MINUTES.map((min) => (
          <option key={min} value={min}>
            {min}
          </option>
        ))}
      </select>
    </div>
  )
}
