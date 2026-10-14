import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
export default function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null)
  const { t } = useI18n()
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-label={title}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <button
          autoFocus
          onClick={onClose}
          aria-label={t('common.close')}
          className="rounded-lg p-2 hover:bg-slate-100"
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}
