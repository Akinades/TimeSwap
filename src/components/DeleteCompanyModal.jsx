import { Trash2, X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

export default function DeleteCompanyModal({
  open,
  companyName,
  onClose,
  onConfirm,
}) {
  const { t } = useI18n()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-company-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h3
              id="delete-company-title"
              className="text-lg font-semibold text-slate-900"
            >
              {t('profile.deleteTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t('common.cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          {t('profile.deleteConfirm')}{' '}
          <span className="font-semibold text-slate-900">
            “{companyName || '—'}”
          </span>
          ?
        </p>
        <p className="mt-2 text-sm text-red-700">{t('profile.deleteWarn')}</p>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            {t('profile.deleteConfirmBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}
