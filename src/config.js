/** Default shift rules used when the import file has no schedule columns */
export const shiftRules = {
  standardIn: '08:00',
  standardOut: '17:00',
  lateThresholdMinutes: 5,
  otAfterMinutes: 30,
}

export const STORAGE_KEY = 'timeswap-workspace-v1'
export const LEGACY_STORAGE_KEY = 'timeswap-data-v1'
export const BACKUP_VERSION = 1

export function createCompanyId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `co_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function emptyCompanyData() {
  return {
    employees: [],
    records: [],
    swapHistory: [],
    activityHistory: [],
    /** Per-employee monthly notes: { [employeeId]: { [YYYY-MM]: string } } */
    summaryNotes: {},
    lastImport: null,
    settings: {
      offWeekdays: [],
      standardIn: shiftRules.standardIn,
      standardOut: shiftRules.standardOut,
      departmentShifts: {},
      shiftTemplates: [],
      inferShiftFromPunch: true,
      weekdayShiftRules: [],
    },
  }
}
