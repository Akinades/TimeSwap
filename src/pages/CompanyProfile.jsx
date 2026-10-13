import { useEffect, useState } from 'react'
import {
  Building2,
  Check,
  Download,
  HardDriveDownload,
  Languages,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import BackupRestoreModal from '../components/BackupRestoreModal'
import DeleteCompanyModal from '../components/DeleteCompanyModal'
import ShiftSettingsForm from '../components/ShiftSettingsForm'

export default function CompanyProfile() {
  const {
    activeCompany,
    activeCompanyId,
    companyName,
    renameCompany,
    removeCompany,
    metrics,
    lastImport,
  } = useApp()
  const { t, locale, lang, setLang, langs } = useI18n()
  const [name, setName] = useState(companyName)
  const [nameSaved, setNameSaved] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [backupTab, setBackupTab] = useState('backup')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    setName(companyName)
    setNameSaved(false)
  }, [companyName, activeCompanyId])

  function handleRename(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !activeCompanyId) return
    renameCompany(activeCompanyId, trimmed)
    setNameSaved(true)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('profile.title')}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{t('profile.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBackupTab('backup')
              setBackupOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Download className="h-4 w-4" />
            {t('dash.backup')}
          </button>
          <button
            type="button"
            onClick={() => {
              setBackupTab('restore')
              setBackupOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
          >
            <HardDriveDownload className="h-4 w-4" />
            {t('dash.restore')}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
        {/* Left: company + language */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                {t('profile.company')}
              </h3>
            </div>
            <form onSubmit={handleRename} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('company.name')}
                </label>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameSaved(false)
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>
                  {t('dash.totalEmployees')}: {metrics.totalEmployees}
                </span>
                <span>
                  {t('dash.items')}: {metrics.totalRecords}
                </span>
              </div>
              {activeCompany?.createdAt && (
                <p className="text-[11px] text-slate-400">
                  {t('profile.created')}:{' '}
                  {new Date(activeCompany.createdAt).toLocaleDateString(locale)}
                </p>
              )}
              {lastImport && (
                <p className="truncate text-[11px] text-slate-400" title={lastImport.fileName}>
                  {t('dash.lastImport')}: {lastImport.fileName}
                </p>
              )}
              {name.trim() !== companyName && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setName(companyName)
                      setNameSaved(false)
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('profile.saveName')}
                  </button>
                </div>
              )}
              {nameSaved && name.trim() === companyName && (
                <span className="text-xs text-emerald-700">
                  {t('profile.nameSaved')}
                </span>
              )}
            </form>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                {t('profile.delete')}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Languages className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                {t('lang.label')}
              </h3>
            </div>
            <div className="flex flex-col gap-1.5">
              {langs.map((l) => {
                const active = l.code === lang
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    className={`inline-flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>
                      {l.label}{' '}
                      <span className={active ? 'text-teal-100' : 'text-slate-400'}>
                        {l.short}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4" />}
                  </button>
                )
              })}
            </div>
          </section>
        </aside>

        {/* Right: shift settings — height follows content */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                {t('shift.title')}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{t('shift.hintShort')}</p>
          </div>
          <div className="p-4">
            <ShiftSettingsForm compact />
          </div>
        </section>
      </div>

      <BackupRestoreModal
        open={backupOpen}
        initialTab={backupTab}
        onClose={() => setBackupOpen(false)}
      />

      <DeleteCompanyModal
        open={deleteOpen}
        companyName={companyName}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (!activeCompanyId) return
          removeCompany(activeCompanyId)
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}
