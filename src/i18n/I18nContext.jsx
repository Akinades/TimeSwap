import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { LANGS, translations } from './translations'

const LANG_KEY = 'timeswap-lang'
const I18nContext = createContext(null)

export function getStoredLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY)
    if (stored && translations[stored]) return stored
  } catch {
    /* ignore */
  }
  return 'th'
}

export function translate(lang, key, vars) {
  const dict = translations[lang] || translations.th
  let text = dict[key] ?? translations.th[key] ?? key
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replaceAll(`{${k}}`, String(v))
    })
  }
  return text
}

export function localeFor(lang) {
  if (lang === 'en') return 'en-US'
  if (lang === 'zh') return 'zh-CN'
  return 'th-TH'
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLang)

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang
  }, [lang])

  function setLang(next) {
    if (!translations[next]) return
    setLangState(next)
  }

  const value = useMemo(
    () => ({
      lang,
      setLang,
      langs: LANGS,
      locale: localeFor(lang),
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
