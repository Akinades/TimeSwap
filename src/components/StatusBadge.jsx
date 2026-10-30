import { useI18n } from '../i18n/I18nContext'
import { badgeStatus } from '../lib/attendance'

const styles = {
  Normal: 'bg-emerald-100 text-emerald-800',
  Absent: 'bg-red-100 text-red-800',
  Holiday: 'bg-slate-100 text-slate-700',
  'Holiday-Worked': 'bg-sky-100 text-sky-800',
  'Leave-Personal': 'bg-violet-100 text-violet-800',
  'Leave-Sick': 'bg-fuchsia-100 text-fuchsia-800',
  'Leave-Vacation': 'bg-cyan-100 text-cyan-800',
  Swapped: 'bg-indigo-100 text-indigo-800',
  Pending: 'bg-orange-100 text-orange-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Store: 'bg-violet-100 text-violet-800',
}

export default function StatusBadge({ status, remark }) {
  const { t } = useI18n()
  const resolved = badgeStatus(status, remark)
  const label = t(`status.${resolved}`)
  const text = label.startsWith('status.') ? resolved : label

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[resolved] || 'bg-slate-100 text-slate-700'}`}
    >
      {text}
    </span>
  )
}
