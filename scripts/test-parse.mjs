import fs from 'fs'
import { pathToFileURL } from 'url'

// Dynamic import of parser — needs browser File API, so reimplement quick check with same module by mocking File
const { createRequire } = await import('module')
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// Inline mirror of critical parsing by importing from source via vite-less approach:
// read file as buffer and call internal logic through a small duplicate test using the built functions.

const filePath = process.argv[2]
const buf = fs.readFileSync(filePath)

// Use the app's parse by simulating File
class FakeFile {
  constructor(buffer, name) {
    this.buffer = buffer
    this.name = name
  }
  async arrayBuffer() {
    return this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength,
    )
  }
}

const { parseHiptimeFile } = await import('../src/lib/parseHiptime.js')

const result = await parseHiptimeFile(
  new FakeFile(buf, filePath.split(/[/\\]/).pop()),
)

console.log('employees', result.employees.length, result.employees.map((e) => e.name).join(', '))
console.log('records', result.meta.rowCount, 'skipped', result.meta.skipped)
console.log('mapped', result.meta.mappedColumns)
console.log('date range', result.records[0]?.date, '→', result.records.at(-1)?.date)
console.log('sample work', result.records.find((r) => r.status !== 'Holiday'))
console.log('sample holiday', result.records.find((r) => r.status === 'Holiday'))
console.log('sample late?', result.records.find((r) => r.status === 'Late'))
console.log(
  'status counts',
  result.records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {}),
)
