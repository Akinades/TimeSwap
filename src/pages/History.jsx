import { useState } from 'react'
import { History as HistoryIcon, Undo2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { canUndo } from '../lib/workflow'
import Dialog from '../components/Dialog'
export default function History() {
  const { activeCompany, activityHistory, undoActivity, employeeMap } = useApp()
  const { t, locale } = useI18n()
  const [confirmId, setConfirmId] = useState(null)
  const [limit, setLimit] = useState(20)
  const confirm = activityHistory.find((e) => e.id === confirmId)
  const describe = (r) =>
    r
      ? `${r.actualIn || '—'} – ${r.actualOut || '—'} · ${t(`status.${r.status}`)}${r.remark ? ` · ${r.remark}` : ''}`
      : t('flow.none')
  return (
    <div className="w-full min-w-0 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('flow.history')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('flow.historyHint')}</p>
        <p className="mt-1 text-xs text-slate-500">{t('flow.undoHint')}</p>
      </div>
      {!activityHistory.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <HistoryIcon className="mx-auto mb-3" />
          {t('common.noData')}
        </div>
      )}
      {activityHistory.slice(0, limit).map((entry) => (
        <article
          key={entry.id}
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {t(`flow.${entry.type}`)}{' '}
                <span className="text-sm font-normal text-slate-400">
                  ·{' '}
                  {entry.type === 'import'
                    ? (entry.summary?.added || 0) +
                      (entry.summary?.updated || 0)
                    : entry.changes.length}{' '}
                  {t('dash.items')}
                </span>
              </h2>
              <p className="mt-1 break-all text-sm text-slate-600">
                {entry.detail}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {new Date(entry.at).toLocaleString(locale)}
              </p>
            </div>
            {entry.undoneAt ? (
              <span
                role="status"
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500"
              >
                {t('flow.undone')}
              </span>
            ) : (
              canUndo(activeCompany, entry) && (
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmId(entry.id)}
                >
                  <Undo2 size={15} />
                  {t('flow.undo')}
                </button>
              )
            )}
          </div>
          {entry.type === 'import' && (
            <p className="mt-3 text-xs text-slate-500">
              {t('flow.add')}: {entry.summary?.added || 0} · {t('flow.update')}:{' '}
              {entry.summary?.updated || 0}
            </p>
          )}
          {!!entry.changes.length && (
            <details className="mt-4 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-sm font-medium text-teal-700">
                {t('flow.details')}
              </summary>
              <div className="mt-3 max-h-80 space-y-3 overflow-auto">
                {entry.changes.map((change) => {
                  const r = change.after || change.before
                  return (
                    <div
                      key={change.key}
                      className="rounded-lg bg-slate-50 p-3 text-xs"
                    >
                      <p className="mb-2 font-medium">
                        {employeeMap[r.employeeId]?.name || r.employeeId} ·{' '}
                        {r.date}
                      </p>
                      <p className="text-slate-500">
                        {t('flow.before')}: {describe(change.before)}
                      </p>
                      <p className="mt-1 text-slate-800">
                        {t('flow.after')}: {describe(change.after)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </article>
      ))}
      {activityHistory.length > limit && (
        <button className="btn-secondary" onClick={() => setLimit(limit + 20)}>
          {t('pager.next')}
        </button>
      )}
      <Dialog
        open={!!confirm}
        onClose={() => setConfirmId(null)}
        title={t('flow.undo')}
      >
        <p className="text-sm">
          {t('flow.undoConfirm', { count: confirm?.changes.length || 0 })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => setConfirmId(null)}>
            {t('common.cancel')}
          </button>
          <button
            className="btn-primary"
            disabled={!canUndo(activeCompany, confirm)}
            onClick={() => {
              undoActivity(confirmId)
              setConfirmId(null)
            }}
          >
            {t('flow.undo')}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
