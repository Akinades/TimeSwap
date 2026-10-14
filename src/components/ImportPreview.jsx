import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { planImport } from '../lib/workflow'
import Dialog from './Dialog'
export default function ImportPreview() {
  const { importPreview, activeCompany, cancelImport, confirmImport } = useApp()
  const { t } = useI18n()
  const [mode, setMode] = useState('skip')
  if (!importPreview) return null
  const { parsed } = importPreview
  const plan = planImport(activeCompany, parsed, mode)
  return (
    <Dialog open onClose={cancelImport} title={t('flow.preview')}>
      <p className="mb-4 break-all text-sm text-slate-500">
        {parsed.meta.fileName} · {parsed.meta.sheetName}
      </p>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['add', plan.added],
          ['duplicates', plan.duplicates],
          ['invalid', parsed.meta.skipped || 0],
          ['internal', plan.internalDuplicates],
        ].map(([key, value]) => (
          <div key={key} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t(`flow.${key}`)}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium">
          {t('flow.duplicates')}
        </legend>
        {['skip', 'replace'].map((value) => (
          <label key={value} className="flex items-start gap-3 text-sm">
            <input
              type="radio"
              name="duplicate-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
              className="mt-1 accent-teal-600"
            />
            {t(`flow.${value}Option`)}
          </label>
        ))}
      </fieldset>
      {mode === 'replace' && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
        >
          {t('flow.replaceWarn')} ({plan.updated})
        </p>
      )}
      <p className="mb-2 mt-5 text-xs text-slate-500">
        {t('flow.sample', {
          count: Math.min(20, plan.rows.length),
          total: plan.rows.length,
        })}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                'common.employee',
                'common.date',
                'att.col.in',
                'att.col.out',
                'common.status',
              ].map((key) => (
                <th key={key} className="p-3">
                  {t(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.rows.slice(0, 20).map((r) => (
              <tr
                key={`${r.employeeId}|${r.date}`}
                className="border-t border-slate-100"
              >
                <td className="p-3">
                  {parsed.employees.find((e) => e.id === r.employeeId)?.name ||
                    r.employeeId}
                </td>
                <td className="p-3">{r.date}</td>
                <td className="p-3">{r.actualIn}</td>
                <td className="p-3">{r.actualOut}</td>
                <td className="p-3">{t(`flow.${r.action}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!parsed.meta.diagnostics?.length && (
        <details className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <summary className="cursor-pointer">
            {t('flow.invalid')} ({parsed.meta.skipped})
          </summary>
          <ul className="mt-2 max-h-40 overflow-auto">
            {parsed.meta.diagnostics.map((d) => (
              <li key={d.row}>
                {t('flow.dataRow', { row: d.row })}:{' '}
                {t(d.reason === 'date' ? 'flow.badDate' : 'flow.badEmployee')}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button className="btn-secondary" onClick={cancelImport}>
          {t('common.cancel')}
        </button>
        <button
          className="btn-primary"
          disabled={!plan.added && !plan.updated}
          onClick={() => confirmImport(mode)}
        >
          {t('flow.confirm')} · {plan.added + plan.updated}
        </button>
      </div>
    </Dialog>
  )
}
