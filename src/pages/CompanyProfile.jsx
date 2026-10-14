import { useEffect, useState } from 'react'
import {
  Building2,
  Check,
  Download,
  HardDriveDownload,
  Languages,
  Settings2,
  Trash2,
  Database,
  Users,
  FileClock,
  ArrowUpRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import BackupRestoreModal from '../components/BackupRestoreModal'
import DeleteCompanyModal from '../components/DeleteCompanyModal'
import ShiftSettingsForm from '../components/ShiftSettingsForm'
import ClearDataModal from '../components/ClearDataModal'

function SectionHeading({ icon: Icon, title, hint }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="rounded-xl bg-teal-50 p-3 text-teal-700">
        <Icon size={21} />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{hint}</p>
      </div>
    </div>
  )
}

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
  const [section, setSection] = useState('company')
  const [name, setName] = useState(companyName)
  const [nameSaved, setNameSaved] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [backupTab, setBackupTab] = useState('backup')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  useEffect(() => {
    setName(companyName)
    setNameSaved(false)
  }, [companyName, activeCompanyId])
  useEffect(() => {
    setBackupOpen(false)
    setDeleteOpen(false)
    setClearOpen(false)
  }, [activeCompanyId])
  function handleRename(event) {
    event.preventDefault()
    if (!name.trim() || !activeCompanyId) return
    renameCompany(activeCompanyId, name.trim())
    setNameSaved(true)
  }
  const sections = [
    ['company', Building2, 'profile.company', 'settings.companyHint'],
    ['shifts', Settings2, 'shift.title', 'shift.hintShort'],
    ['language', Languages, 'lang.label', 'profile.langHint'],
    ['data', Database, 'flow.dataManagement', 'settings.dataHint'],
  ]
  const openBackup = (tab) => {
    setBackupTab(tab)
    setBackupOpen(true)
  }
  const card = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7'
  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-teal-700">
          TimeSwap / {companyName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t('flow.settings')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('settings.intro')}</p>
      </div>
      <nav
        aria-label={t('flow.settings')}
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {sections.map(([key, Icon, title, hint]) => (
          <button
            key={key}
            type="button"
            aria-pressed={section === key}
            aria-controls={`settings-${key}`}
            onClick={() => setSection(key)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition sm:p-5 ${section === key ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'}`}
          >
            <Icon
              size={20}
              className={`mt-0.5 shrink-0 ${section === key ? 'text-teal-700' : 'text-slate-400'}`}
            />
            <span className="min-w-0">
              <span
                className={`block text-sm font-semibold ${section === key ? 'text-teal-900' : 'text-slate-700'}`}
              >
                {t(title)}
              </span>
              <span className="mt-1 hidden text-xs leading-relaxed text-slate-500 sm:block">
                {t(hint)}
              </span>
            </span>
          </button>
        ))}
      </nav>
      <div id="settings-company" hidden={section !== 'company'}>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className={card}>
            <SectionHeading
              icon={Building2}
              title={t('profile.company')}
              hint={t('settings.companyHint')}
            />
            <form onSubmit={handleRename}>
              <label
                htmlFor="company-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {t('company.name')}
              </label>
              <input
                id="company-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameSaved(false)
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p role="status" className="text-sm text-teal-700">
                  {nameSaved && name.trim() === companyName
                    ? t('profile.nameSaved')
                    : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={name === companyName}
                    className="btn-secondary"
                    onClick={() => {
                      setName(companyName)
                      setNameSaved(false)
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || name.trim() === companyName}
                    className="btn-primary"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </form>
          </section>
          <aside className={card}>
            <h2 className="mb-5 text-base font-semibold">
              {t('settings.workspace')}
            </h2>
            <dl className="space-y-5">
              {[
                [Users, 'dash.totalEmployees', metrics.totalEmployees],
                [FileClock, 'dash.items', metrics.totalRecords],
              ].map(([Icon, label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="flex items-center gap-2 text-sm text-slate-500">
                    <Icon size={17} />
                    {t(label)}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {value.toLocaleString(locale)}
                  </dd>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-4">
                <dt className="text-xs text-slate-500">
                  {t('profile.created')}
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {activeCompany?.createdAt
                    ? new Date(activeCompany.createdAt).toLocaleDateString(
                        locale,
                      )
                    : '—'}
                </dd>
              </div>
            </dl>
            <Link
              to="/history"
              className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              {t('flow.history')}
              <ArrowUpRight size={16} />
            </Link>
          </aside>
        </div>
      </div>
      <section
        id="settings-shifts"
        hidden={section !== 'shifts'}
        className={card}
      >
        <SectionHeading
          icon={Settings2}
          title={t('shift.title')}
          hint={t('shift.hintShort')}
        />
        <div className="settings-shift-form">
          <ShiftSettingsForm key={activeCompanyId} />
        </div>
      </section>
      <section
        id="settings-language"
        hidden={section !== 'language'}
        className={card}
      >
        <SectionHeading
          icon={Languages}
          title={t('lang.label')}
          hint={t('settings.languageHint')}
        />
        <fieldset>
          <legend className="sr-only">{t('lang.label')}</legend>
          <div className="grid gap-4 md:grid-cols-3">
            {langs.map((l) => (
              <label
                key={l.code}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-5 transition ${lang === l.code ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300'}`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="settings-language"
                    checked={lang === l.code}
                    onChange={() => setLang(l.code)}
                    className="h-4 w-4 accent-teal-600"
                  />
                  <span>
                    <span className="block text-base font-semibold text-slate-800">
                      {l.label}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {l.short}
                    </span>
                  </span>
                </span>
                {lang === l.code && (
                  <Check size={19} className="text-teal-700" />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <div id="settings-data" hidden={section !== 'data'} className="space-y-6">
        <section className={card}>
          <SectionHeading
            icon={Database}
            title={t('profile.dataTitle')}
            hint={t('profile.dataHint')}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              ['backup', Download, 'dash.backup', 'settings.backupHint'],
              [
                'restore',
                HardDriveDownload,
                'dash.restore',
                'settings.restoreHint',
              ],
            ].map(([key, Icon, title, hint]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6"
              >
                <Icon size={26} className="mb-4 text-teal-700" />
                <h3 className="text-base font-semibold">{t(title)}</h3>
                <p className="mb-5 mt-2 text-sm leading-relaxed text-slate-500">
                  {t(hint)}
                </p>
                <button
                  type="button"
                  className={key === 'backup' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => openBackup(key)}
                >
                  {t(title)}
                </button>
              </div>
            ))}
          </div>
          {lastImport && (
            <div className="mt-5 flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <p className="break-all">
                {t('dash.lastImport')}:{' '}
                <span className="font-medium text-slate-700">
                  {lastImport.fileName}
                </span>
              </p>
              <p>{new Date(lastImport.importedAt).toLocaleString(locale)}</p>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-red-200 bg-white p-5 sm:p-7">
          <h2 className="text-base font-semibold text-red-800">
            {t('settings.deleteTitle')}
          </h2>
          <div className="mt-4 divide-y divide-red-100">
            {[
              [
                'dash.clearData',
                'settings.clearHint',
                () => setClearOpen(true),
              ],
              [
                'profile.delete',
                'profile.deleteWarn',
                () => setDeleteOpen(true),
              ],
            ].map(([title, hint, action]) => (
              <div
                key={title}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <h3 className="text-sm font-medium text-slate-800">
                    {t(title)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {t(hint)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={action}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  {t(title)}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      <ClearDataModal open={clearOpen} onClose={() => setClearOpen(false)} />
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
          if (activeCompanyId) removeCompany(activeCompanyId)
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}
