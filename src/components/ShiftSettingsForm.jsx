import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import {
  WEEKDAY_KEYS,
  normalizeSettings,
  newTemplateId,
} from '../lib/shiftRoutine'
import TimeInput24 from './TimeInput24'

const SUGGESTED = [
  { name: 'กะเช้า', in: '08:00', out: '18:00' },
  { name: 'กะสาย', in: '08:30', out: '19:00' },
  { name: 'กะปกติ', in: '08:00', out: '19:00' },
]

function snapshotSettings(s) {
  return JSON.stringify({
    offWeekdays: [...(s.offWeekdays || [])].sort((a, b) => a - b),
    standardIn: s.standardIn,
    standardOut: s.standardOut,
    inferShiftFromPunch: s.inferShiftFromPunch,
    shiftTemplates: (s.shiftTemplates || []).map((r) => ({
      id: r.id,
      name: r.name,
      in: r.in,
      out: r.out,
    })),
    weekdayShiftRules: (s.weekdayShiftRules || []).map((r) => ({
      id: r.id,
      name: r.name,
      days: [...(r.days || [])].sort((a, b) => a - b),
      in: r.in,
      out: r.out,
      departments: [...(r.departments || [])].sort((a, b) =>
        a.localeCompare(b, 'th'),
      ),
    })),
    departmentShifts: s.departmentShifts || {},
  })
}

export default function ShiftSettingsForm({ compact = false }) {
  const {
    companySettings,
    updateCompanySettings,
    hasData,
    uploadFeedback,
    employees,
  } = useApp()
  const { t } = useI18n()
  const [offWeekdays, setOffWeekdays] = useState([])
  const [standardIn, setStandardIn] = useState('08:00')
  const [standardOut, setStandardOut] = useState('17:00')
  const [shiftTemplates, setShiftTemplates] = useState([])
  const [inferShiftFromPunch, setInferShiftFromPunch] = useState(true)
  const [weekdayShiftRules, setWeekdayShiftRules] = useState([])
  const [departmentShifts, setDepartmentShifts] = useState({})
  const [showDept, setShowDept] = useState(false)
  const [applyExisting, setApplyExisting] = useState(true)
  const [baseline, setBaseline] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const departments = useMemo(() => {
    const set = new Set()
    for (const e of employees || []) {
      const d = String(e.department || '').trim()
      if (d && d !== '—') set.add(d)
    }
    for (const d of Object.keys(departmentShifts)) {
      if (d) set.add(d)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'th'))
  }, [employees, departmentShifts])

  function loadFromSettings(raw) {
    const s = normalizeSettings(raw)
    setOffWeekdays(s.offWeekdays)
    setStandardIn(s.standardIn)
    setStandardOut(s.standardOut)
    setShiftTemplates(s.shiftTemplates || [])
    setInferShiftFromPunch(s.inferShiftFromPunch)
    setWeekdayShiftRules(s.weekdayShiftRules || [])
    setDepartmentShifts(s.departmentShifts || {})
    if (Object.keys(s.departmentShifts || {}).length) setShowDept(true)
    setBaseline(
      snapshotSettings({
        offWeekdays: s.offWeekdays,
        standardIn: s.standardIn,
        standardOut: s.standardOut,
        inferShiftFromPunch: s.inferShiftFromPunch,
        shiftTemplates: s.shiftTemplates || [],
        weekdayShiftRules: s.weekdayShiftRules || [],
        departmentShifts: s.departmentShifts || {},
      }),
    )
  }

  useEffect(() => {
    loadFromSettings(companySettings)
    setJustSaved(false)
  }, [companySettings])

  const dirty = useMemo(() => {
    if (!baseline) return false
    return (
      snapshotSettings({
        offWeekdays,
        standardIn,
        standardOut,
        inferShiftFromPunch,
        shiftTemplates,
        weekdayShiftRules,
        departmentShifts,
      }) !== baseline
    )
  }, [
    baseline,
    offWeekdays,
    standardIn,
    standardOut,
    inferShiftFromPunch,
    shiftTemplates,
    weekdayShiftRules,
    departmentShifts,
  ])

  function markDirty() {
    setJustSaved(false)
  }

  function toggleDay(day) {
    setOffWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort(),
    )
    markDirty()
  }

  function addTemplate(preset) {
    setShiftTemplates((prev) => [
      ...prev,
      {
        id: newTemplateId(),
        name: preset?.name || '',
        in: preset?.in || standardIn,
        out: preset?.out || standardOut,
      },
    ])
    markDirty()
  }

  function updateTemplate(id, patch) {
    setShiftTemplates((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
    markDirty()
  }

  function removeTemplate(id) {
    setShiftTemplates((prev) => prev.filter((row) => row.id !== id))
    markDirty()
  }

  function addSuggestedPair() {
    setShiftTemplates((prev) => {
      const names = new Set(prev.map((r) => r.name))
      const next = [...prev]
      for (const s of SUGGESTED) {
        if (!names.has(s.name)) {
          next.push({
            id: newTemplateId(),
            name: s.name,
            in: s.in,
            out: s.out,
          })
          names.add(s.name)
        }
      }
      return next
    })
    markDirty()
  }

  function setDeptShift(dept, field, value) {
    setDepartmentShifts((prev) => {
      const current = prev[dept] || { in: standardIn, out: standardOut }
      return {
        ...prev,
        [dept]: {
          ...current,
          [field]: value,
        },
      }
    })
    markDirty()
  }

  function clearDeptShift(dept) {
    setDepartmentShifts((prev) => {
      const next = { ...prev }
      delete next[dept]
      return next
    })
    markDirty()
  }

  function addWeekdayRule(preset) {
    setWeekdayShiftRules((prev) => [
      ...prev,
      {
        id: newTemplateId(),
        name: preset?.name || '',
        days: preset?.days ? [...preset.days] : [6, 0],
        in: preset?.in || '08:00',
        out: preset?.out || '19:00',
        // empty = all departments
        departments: preset?.departments ? [...preset.departments] : [],
      },
    ])
    markDirty()
  }

  function toggleWeekdayRuleDept(id, dept) {
    setWeekdayShiftRules((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const list = row.departments || []
        const has = list.includes(dept)
        let next = has
          ? list.filter((d) => d !== dept)
          : [...list, dept].sort((a, b) => a.localeCompare(b, 'th'))
        // empty list means "all" — don't clear the last checkbox into all
        if (next.length === 0) return row
        if (
          departments.length > 0 &&
          next.length === departments.length &&
          departments.every((d) => next.includes(d))
        ) {
          next = []
        }
        return { ...row, departments: next }
      }),
    )
    markDirty()
  }

  function setWeekdayRuleAllDepts(id) {
    setWeekdayShiftRules((prev) =>
      prev.map((row) => (row.id === id ? { ...row, departments: [] } : row)),
    )
    markDirty()
  }

  function updateWeekdayRule(id, patch) {
    setWeekdayShiftRules((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
    markDirty()
  }

  function toggleWeekdayRuleDay(id, day) {
    setWeekdayShiftRules((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const has = row.days.includes(day)
        const days = has
          ? row.days.filter((d) => d !== day)
          : [...row.days, day].sort((a, b) => a - b)
        return { ...row, days }
      }),
    )
    markDirty()
  }

  function removeWeekdayRule(id) {
    setWeekdayShiftRules((prev) => prev.filter((row) => row.id !== id))
    markDirty()
  }

  function handleCancel() {
    loadFromSettings(companySettings)
    setJustSaved(false)
  }

  function handleSave(e) {
    e.preventDefault()
    if (!dirty) return
    const cleanedDept = {}
    for (const dept of departments) {
      const row = departmentShifts[dept]
      if (!row) continue
      const inn = row.in || standardIn
      const out = row.out || standardOut
      if (inn !== standardIn || out !== standardOut) {
        cleanedDept[dept] = { in: inn, out }
      }
    }
    const cleanedTemplates = shiftTemplates
      .filter((row) => row.in && row.out)
      .map((row) => ({
        id: row.id || newTemplateId(),
        name: String(row.name || '').trim() || `${row.in}–${row.out}`,
        in: row.in,
        out: row.out,
      }))

    const cleanedWeekdayRules = weekdayShiftRules
      .filter((row) => row.in && row.out && row.days?.length)
      .map((row) => ({
        id: row.id || newTemplateId(),
        name: String(row.name || '').trim() || `${row.in}–${row.out}`,
        days: [...row.days].sort((a, b) => a - b),
        in: row.in,
        out: row.out,
        departments: [...(row.departments || [])].sort((a, b) =>
          a.localeCompare(b, 'th'),
        ),
      }))

    updateCompanySettings(
      {
        offWeekdays,
        standardIn,
        standardOut,
        shiftTemplates: cleanedTemplates,
        inferShiftFromPunch,
        weekdayShiftRules: cleanedWeekdayRules,
        departmentShifts: cleanedDept,
      },
      { applyToExisting: applyExisting && hasData },
    )
    setJustSaved(true)
  }

  const gap = compact ? 'space-y-3' : 'space-y-5'
  const dayBtn = compact
    ? 'rounded-md px-1.5 py-1.5 text-center text-xs font-medium transition'
    : 'rounded-lg px-2 py-2.5 text-center text-sm font-medium transition'

  return (
    <form onSubmit={handleSave} className={gap}>
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">
          {t('shift.offDays')}
        </p>
        {!compact && (
          <p className="mb-3 text-xs text-slate-400">
            {t('shift.offDaysHint')}
          </p>
        )}
        <div className="grid max-w-md grid-cols-7 gap-1.5">
          {WEEKDAY_KEYS.map((day) => {
            const active = offWeekdays.includes(day)
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`${dayBtn} ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {t(`shift.day.${day}`)}
              </button>
            )
          })}
        </div>
        {offWeekdays.length === 0 && (
          <p className="mt-1.5 text-[11px] text-amber-700">
            {t('shift.noOffWarn')}
          </p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-500">
          {t('shift.workHours')}
        </p>
        {!compact && (
          <p className="mb-3 text-xs text-slate-400">
            {t('shift.workHoursHint')}
          </p>
        )}
        <div className="grid max-w-xs grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">
              {t('shift.standardIn')}
            </label>
            <TimeInput24
              value={standardIn}
              onChange={(v) => {
                setStandardIn(v)
                markDirty()
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">
              {t('shift.standardOut')}
            </label>
            <TimeInput24
              value={standardOut}
              onChange={(v) => {
                setStandardOut(v)
                markDirty()
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">
            {t('shift.templates')}
          </p>
          <div className="flex flex-wrap gap-2">
            {shiftTemplates.length === 0 && (
              <button
                type="button"
                onClick={addSuggestedPair}
                className="text-xs font-medium text-teal-700 hover:text-teal-900"
              >
                {t('shift.templatesSuggest')}
              </button>
            )}
            <button
              type="button"
              onClick={() => addTemplate()}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('shift.templatesAdd')}
            </button>
          </div>
        </div>
        {!compact && (
          <p className="mb-3 text-xs text-slate-400">
            {t('shift.templatesHint')}
          </p>
        )}

        {shiftTemplates.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t('shift.templatesEmpty')}
          </p>
        ) : (
          <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
            {shiftTemplates.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 sm:grid-cols-[minmax(7.5rem,1fr)_6.75rem_6.75rem_auto] items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
              >
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) =>
                    updateTemplate(row.id, { name: e.target.value })
                  }
                  placeholder="กะเช้า"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                />
                <TimeInput24
                  value={row.in}
                  onChange={(v) => updateTemplate(row.id, { in: v })}
                />
                <TimeInput24
                  value={row.out}
                  onChange={(v) => updateTemplate(row.id, { out: v })}
                />
                <button
                  type="button"
                  onClick={() => removeTemplate(row.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {shiftTemplates.length > 0 && (
          <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={inferShiftFromPunch}
              onChange={(e) => {
                setInferShiftFromPunch(e.target.checked)
                markDirty()
              }}
            />
            <span>{t('shift.infer')}</span>
          </label>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">
            {t('shift.weekdayRules')}
          </p>
          <div className="flex flex-wrap gap-2">
            {weekdayShiftRules.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  addWeekdayRule({
                    name: 'เสาร์–อาทิตย์',
                    days: [6, 0],
                    in: '08:00',
                    out: '19:00',
                  })
                }
                className="text-xs font-medium text-teal-700 hover:text-teal-900"
              >
                {t('shift.weekdayRulesSuggest')}
              </button>
            )}
            <button
              type="button"
              onClick={() => addWeekdayRule()}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('shift.weekdayRulesAdd')}
            </button>
          </div>
        </div>
        {!compact && (
          <p className="mb-2 text-xs text-slate-400">
            {t('shift.weekdayRulesHint')}
          </p>
        )}
        {weekdayShiftRules.length === 0 ? (
          <p className="text-xs text-slate-400">
            {t('shift.weekdayRulesEmpty')}
          </p>
        ) : (
          <div className="space-y-2">
            {weekdayShiftRules.map((row) => (
              <div
                key={row.id}
                className="space-y-2 rounded-lg bg-slate-50 px-2.5 py-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(7.5rem,1fr)_6.75rem_6.75rem_auto] items-center gap-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) =>
                      updateWeekdayRule(row.id, { name: e.target.value })
                    }
                    placeholder="เสาร์–อาทิตย์"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-teal-500"
                  />
                  <TimeInput24
                    value={row.in}
                    onChange={(v) => updateWeekdayRule(row.id, { in: v })}
                  />
                  <TimeInput24
                    value={row.out}
                    onChange={(v) => updateWeekdayRule(row.id, { out: v })}
                  />
                  <button
                    type="button"
                    onClick={() => removeWeekdayRule(row.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_KEYS.map((day) => {
                    const active = row.days.includes(day)
                    const isOff = offWeekdays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isOff}
                        title={
                          isOff ? t('shift.weekdayRulesOffDay') : undefined
                        }
                        onClick={() => toggleWeekdayRuleDay(row.id, day)}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                          isOff
                            ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                            : active
                              ? 'bg-teal-600 text-white'
                              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t(`shift.day.${day}`)}
                      </button>
                    )
                  })}
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-slate-500">
                    {t('shift.weekdayRulesDepts')}
                  </p>
                  {departments.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      {t('shift.weekdayRulesDeptsEmpty')}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700">
                        <input
                          type="checkbox"
                          checked={(row.departments || []).length === 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWeekdayRuleAllDepts(row.id)
                            } else {
                              updateWeekdayRule(row.id, {
                                departments: [...departments],
                              })
                            }
                          }}
                        />
                        {t('shift.weekdayRulesAllDepts')}
                      </label>
                      {departments.map((dept) => {
                        const all = (row.departments || []).length === 0
                        const checked =
                          all || (row.departments || []).includes(dept)
                        return (
                          <label
                            key={dept}
                            className="inline-flex items-center gap-1.5 text-[11px] text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (all) {
                                  updateWeekdayRule(row.id, {
                                    departments: departments.filter(
                                      (d) => d !== dept,
                                    ),
                                  })
                                } else {
                                  toggleWeekdayRuleDept(row.id, dept)
                                }
                              }}
                            />
                            {dept}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowDept((v) => !v)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {showDept ? t('shift.byDeptHide') : t('shift.byDeptShow')}
        </button>
        {showDept && (
          <div className="mt-2">
            {!compact && (
              <p className="mb-2 text-xs text-slate-400">
                {t('shift.byDeptHint')}
              </p>
            )}
            {departments.length === 0 ? (
              <p className="text-xs text-slate-400">{t('shift.byDeptEmpty')}</p>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                {departments.map((dept) => {
                  const custom = departmentShifts[dept]
                  const inn = custom?.in || standardIn
                  const out = custom?.out || standardOut
                  const isCustom = Boolean(custom)
                  return (
                    <div
                      key={dept}
                      className="grid grid-cols-1 sm:grid-cols-[minmax(7.5rem,1fr)_6.75rem_6.75rem_auto] items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                    >
                      <p className="truncate text-sm font-medium text-slate-800">
                        {dept}
                      </p>
                      <TimeInput24
                        value={inn}
                        onChange={(v) => setDeptShift(dept, 'in', v)}
                      />
                      <TimeInput24
                        value={out}
                        onChange={(v) => setDeptShift(dept, 'out', v)}
                      />
                      {isCustom ? (
                        <button
                          type="button"
                          onClick={() => clearDeptShift(dept)}
                          className="whitespace-nowrap text-[11px] text-slate-500 hover:text-slate-800"
                        >
                          {t('shift.byDeptReset')}
                        </button>
                      ) : (
                        <span className="w-8" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {dirty && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          {hasData && (
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={applyExisting}
                onChange={(e) => setApplyExisting(e.target.checked)}
              />
              <span>{t('shift.applyExisting')}</span>
            </label>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {t('common.save')}
          </button>
        </div>
      )}

      {!dirty && justSaved && uploadFeedback?.type === 'success' && (
        <p className="text-xs text-emerald-700">{uploadFeedback.message}</p>
      )}
    </form>
  )
}
