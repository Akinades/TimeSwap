const fs = require('fs')
const XLSX = require('xlsx')

function formatTime(value) {
  const raw = String(value ?? '').trim()
  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/)
  if (ampm) {
    let h = Number(ampm[1])
    const m = ampm[2]
    const period = ampm[3].toUpperCase()
    if (period === 'AM') {
      if (h === 12) h = 0
    } else if (h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${m}`
  }
  return raw
}

function detectDateOrder(values) {
  let mdy = 0
  let dmy = 0
  const firsts = []
  const seconds = []
  for (const value of values) {
    const m = String(value)
      .trim()
      .match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
    if (!m) continue
    const a = +m[1]
    const b = +m[2]
    const y = +m[3]
    firsts.push(a)
    seconds.push(b)
    if (a > 12 && b <= 12) dmy++
    else if (b > 12 && a <= 12) mdy++
    else if (y >= 2400) dmy++
  }
  if (mdy > dmy) return 'MDY'
  if (dmy > mdy) return 'DMY'
  const maxF = Math.max(...firsts, 0)
  const maxS = Math.max(...seconds, 0)
  if (maxF <= 12 && maxS > 12) return 'MDY'
  if (maxS <= 12 && maxF > 12) return 'DMY'
  return 'DMY'
}

function parseDate(value, order) {
  const m = String(value)
    .trim()
    .match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  const y = m[3]
  if (order === 'MDY') return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

const buf = fs.readFileSync(process.argv[2])
const wb = XLSX.read(buf, { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets.Sheet1, { defval: '', raw: false })
const order = detectDateOrder(rows.map((r) => r.Date))
console.log('order', order)
console.log('sample date', rows[0].Date, '→', parseDate(rows[0].Date, order))
console.log('times', rows[0]['1'], '→', formatTime(rows[0]['1']), rows[0]['2'], '→', formatTime(rows[0]['2']))
console.log('empty day', rows[2].Date, rows[2]['1'], rows[2]['2'])

let work = 0
let off = 0
const names = new Set()
for (const r of rows) {
  names.add(r['Name - Surname '])
  const has = r['1'] || r['2'] || r['3'] || r['4']
  if (has) work++
  else off++
  const d = parseDate(r.Date, order)
  if (!d.startsWith('2026-08')) {
    console.error('BAD', r.Date, d)
    process.exit(1)
  }
}
console.log({ rows: rows.length, work, off, employees: names.size })
console.log('OK')
