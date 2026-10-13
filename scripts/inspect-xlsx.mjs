import * as XLSX from 'xlsx'
import path from 'path'

const file = process.argv[2]
const wb = XLSX.readFile(file)
console.log('sheets', wb.SheetNames)

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name]
  console.log('\n===', name, 'ref', sheet['!ref'])
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  console.log('total rows', rows.length)
  rows.slice(0, 40).forEach((r, i) => {
    console.log(String(i).padStart(2), JSON.stringify(r))
  })
  if (rows.length > 40) {
    console.log('...')
    rows.slice(-5).forEach((r, i) => {
      console.log(String(rows.length - 5 + i).padStart(2), JSON.stringify(r))
    })
  }
}
