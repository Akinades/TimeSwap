import { useState } from 'react'
import { Languages } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

/** Compact language picker — used on setup screen before company exists */
export default function LanguageSwitcher() {
  const { lang, setLang, langs, t } = useI18n()
  const [open, setOpen] = useState(false)
  const current = langs.find((l) => l.code === lang) || langs[0]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"
        aria-label={t('lang.label')}
        title={t('lang.label')}
      >
        <Languages className="h-4 w-4 text-teal-600" />
        <span>{current.short}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
              {t('lang.label')}
            </div>
            <ul className="py-1">
              {langs.map((l) => (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setLang(l.code)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                      l.code === lang
                        ? 'font-semibold text-teal-700'
                        : 'text-slate-700'
                    }`}
                  >
                    <span>{l.label}</span>
                    <span className="text-xs text-slate-400">{l.short}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
