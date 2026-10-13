const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

// Load parser by evaluating rewritten as CJS via dynamic transpile of just what we need:
// Instead, duplicate critical checks + call through a minimal port.

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\]+/g, '')
    .replace(/[\[\](){}]/g, '')
    .replace(/\d+$/g, '')
}

function toChristYear(year) {
  const y = Number(year)
  return y >= 2400 ? y - 543 : y
}

function parseDateValue(value) {
  const raw = String(value).trim()
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    const yyyy = String(toChristYear(dmy[3]))
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

function parseScheduleRange(value) {
  const raw = String(value ?? '').trim()
  const match = raw.match(/(\d{1,2}:\d{2})\s*[~\-–—ถึง]+\s*(\d{1,2}:\d{2})/)
  if (!match) return null
  return { in: match[1], out: match[2] }
}

const filePath = process.argv[2]
const buf = fs.readFileSync(filePath)
const wb = XLSX.read(buf, { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  defval: '',
  raw: false,
})

const headers = Object.keys(rows[0])
console.log('headers', headers)
console.log(
  'normalized',
  headers.map((h) => [h, normalizeHeader(h)]),
)

const dateSamples = [...new Set(rows.slice(0, 5).map((r) => r['วัน/เวลา ']))]
console.log(
  'dates',
  dateSamples.map((d) => `${d} → ${parseDateValue(d)}`),
)

const rangeSamples = rows
  .filter((r) => r['เข้า-ออก [1]'])
  .slice(0, 3)
  .map((r) => `${r['เข้า-ออก [1]']} → ${JSON.stringify(parseScheduleRange(r['เข้า-ออก [1]']))}`)
console.log('ranges', rangeSamples)

// Simulate mapping priorities
const keys = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }))
const schedule = keys.find((h) => h.key.includes('เข้าออก'))
const actualIn = keys.find(
  (h) => h.key.startsWith('เข้า') && !h.key.includes('ออก') && !h.key.includes('เข้าออก'),
)
const actualOut = keys.find((h) => h.key === 'ออก' || (h.key.startsWith('ออก') && !h.key.includes('เข้า')))
console.log('map schedule', schedule)
console.log('map actualIn', actualIn)
console.log('map actualOut', actualOut)

let ok = 0
let holiday = 0
let work = 0
const employees = new Set()
for (const r of rows) {
  const d = parseDateValue(r['วัน/เวลา '])
  if (!d || !d.startsWith('2026-09')) {
    console.error('BAD DATE', r['วัน/เวลา '], d)
    process.exit(1)
  }
  employees.add(r['ชื่อพนักงาน'])
  if (r['สถานะ'] === 'วันหยุด') holiday++
  else work++
  ok++
}
console.log({ ok, work, holiday, employees: employees.size, sampleDate: parseDateValue(rows[0]['วัน/เวลา ']) })
console.log('RANGE parse', parseScheduleRange('08:30 ~19:00'))
