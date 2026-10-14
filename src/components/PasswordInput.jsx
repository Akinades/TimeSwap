import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

/**
 * Password field with show/hide toggle.
 * Pass `withIcon` to show a lock icon on the left (login style).
 */
export default function PasswordInput({
  value,
  onChange,
  className = '',
  withIcon = false,
  autoComplete = 'current-password',
  ...rest
}) {
  const [visible, setVisible] = useState(false)

  const inputClass = withIcon
    ? `w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-10 pl-10 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 ${className}`
    : `w-full rounded-lg border border-slate-300 bg-white py-2 pr-10 pl-3 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 ${className}`

  return (
    <div className="relative">
      {withIcon ? (
        <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
      ) : null}
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className={inputClass}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
