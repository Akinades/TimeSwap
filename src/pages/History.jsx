import { useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileUp,
  History as HistoryIcon,
  Pencil,
  RefreshCw,
  Undo2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { canUndo } from '../lib/workflow'
import Dialog from '../components/Dialog'

const TYPE_META = {
  import: {
    icon: FileUp,
    tone: 'bg-sky-50 text-sky-700 ring-sky-200',
    rail: 'bg-sky-500',
  },
  edit: {
    icon: Pencil,
    tone: 'bg-amber-50 text-amber-800 ring-amber-200',
    rail: 'bg-amber-500',
  },
  swap: {
    icon: RefreshCw,
    tone: 'bg-violet-50 text-violet-800 ring-violet-200',
    rail: 'bg-violet-500',
  },
}

function PunchChip({ record, t, empty }) {
  if (!record) {
    return (
      <span className="text-xs text-slate-400 italic">{empty || t('flow.none')}</span>
    )
  }
  const statusKey = `status.${record.status}`
  const statusLabel = t(statusKey)
  const status =
    statusLabel.startsWith('status.') ? record.status : statusLabel
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
      <span className="font-medium tabular-nums">
        {record.actualIn || '—'}–{record.actualOut || '—'}
      </span>
      <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
        {status}
      </span>
      {record.remark ? (
        <span className="text-xs text-slate-500">{record.remark}</span>
      ) : null}
    </span>
  )
}

function ChangeRow({ change, employeeMap, t }) {
  const rec = change.after || change.before
  const name = employeeMap[rec?.employeeId]?.name || rec?.employeeId || '—'
  const isCreate = !change.before && change.after
  const isRemove = change.before && !change.after

  return (
    <div className="grid gap-2 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-400 tabular-nums">{rec?.date}</p>
      </div>
      <div className="min-w-0 sm:text-right">
        {isCreate ? (
          <div className="inline-flex flex-col items-start gap-1 sm:items-end">
            <span className="text-[11px] font-medium text-emerald-700">
              {t('flow.created')}
            </span>
            <PunchChip record={change.after} t={t} />
          </div>
        ) : isRemove ? (
          <div className="inline-flex flex-col items-start gap-1 sm:items-end">
            <span className="text-[11px] font-medium text-red-600">
              {t('flow.removed')}
            </span>
            <PunchChip record={change.before} t={t} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="rounded-lg bg-slate-100/80 px-2 py-1">
                <PunchChip record={change.before} t={t} />
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span className="rounded-lg bg-teal-50 px-2 py-1 ring-1 ring-teal-100">
                <PunchChip record={change.after} t={t} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function History() {
  const { activeCompany, activityHistory, undoActivity, employeeMap } = useApp()
  const { t, locale } = useI18n()
  const [confirmId, setConfirmId] = useState(null)
  const [limit, setLimit] = useState(20)
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(() => new Set())

  const confirm = activityHistory.find((e) => e.id === confirmId)

  const filtered = useMemo(() => {
    if (filter === 'all') return activityHistory
    return activityHistory.filter((e) => e.type === filter)
  }, [activityHistory, filter])

  const visible = filtered.slice(0, limit)

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filters = [
    { id: 'all', label: t('flow.filterAll') },
    { id: 'import', label: t('flow.import') },
    { id: 'edit', label: t('flow.edit') },
    { id: 'swap', label: t('flow.swap') },
  ]

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t('flow.history')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {t('flow.historyHint')}
          </p>
        </div>
        {activityHistory.length > 0 ? (
          <p className="text-sm text-slate-400">
            {t('flow.changeCount', { count: filtered.length })}
          </p>
        ) : null}
      </div>

      {activityHistory.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id)
                  setLimit(20)
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {!activityHistory.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <HistoryIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            {t('common.noData')}
          </p>
          <p className="mt-1 text-xs text-slate-400">{t('flow.historyHint')}</p>
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {t('flow.emptyFilter')}
        </div>
      ) : (
        <ol className="relative space-y-0">
          {visible.map((entry, index) => {
            const meta = TYPE_META[entry.type] || TYPE_META.edit
            const Icon = meta.icon
            const count =
              entry.type === 'import'
                ? (entry.summary?.added || 0) + (entry.summary?.updated || 0)
                : entry.changes.length
            const isOpen = expanded.has(entry.id)
            const undoable =
              !entry.undoneAt && canUndo(activeCompany, entry)
            const isLast = index === visible.length - 1

            return (
              <li key={entry.id} className="relative flex gap-4 pb-6">
                {!isLast ? (
                  <span
                    className="absolute top-10 bottom-0 left-[15px] w-px bg-slate-200"
                    aria-hidden
                  />
                ) : null}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${meta.rail}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${meta.tone}`}
                        >
                          {t(`flow.${entry.type}`)}
                        </span>
                        {entry.undoneAt ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            {t('flow.undone')}
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-400">
                          {t('flow.changeCount', { count })}
                        </span>
                      </div>
                      {entry.detail ? (
                        <p className="mt-1.5 break-words text-sm text-slate-700">
                          {entry.detail}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(entry.at).toLocaleString(locale, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                      {entry.type === 'import' ? (
                        <p className="mt-2 text-xs text-slate-500">
                          <span className="font-medium text-emerald-700">
                            {t('flow.add')} {entry.summary?.added || 0}
                          </span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-medium text-sky-700">
                            {t('flow.update')} {entry.summary?.updated || 0}
                          </span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {undoable ? (
                        <button
                          type="button"
                          className="btn-secondary !min-h-9 !px-3 !text-xs"
                          onClick={() => setConfirmId(entry.id)}
                        >
                          <Undo2 size={14} />
                          {t('flow.undo')}
                        </button>
                      ) : null}
                      {entry.changes.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(entry.id)}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
                        >
                          {isOpen ? (
                            <>
                              {t('flow.hideChanges')}
                              <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              {t('flow.showChanges', {
                                count: entry.changes.length,
                              })}
                              <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isOpen && entry.changes.length > 0 ? (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-1 sm:px-5">
                      <div className="max-h-96 overflow-y-auto">
                        {entry.changes.map((change) => (
                          <ChangeRow
                            key={change.key}
                            change={change}
                            employeeMap={employeeMap}
                            t={t}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {filtered.length > limit ? (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setLimit((n) => n + 20)}
          >
            {t('flow.loadMore')}
          </button>
        </div>
      ) : null}

      <p className="text-center text-[11px] text-slate-400">
        {t('flow.undoHint')}
      </p>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirmId(null)}
        title={t('flow.undo')}
      >
        <p className="text-sm text-slate-600">
          {t('flow.undoConfirm', { count: confirm?.changes.length || 0 })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmId(null)}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
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
