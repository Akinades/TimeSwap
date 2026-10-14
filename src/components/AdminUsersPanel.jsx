import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  KeyRound,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import PasswordInput from './PasswordInput'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import {
  createUserRequest,
  deleteUserRequest,
  fetchUsers,
  updateUserPasswordRequest,
  updateUserRoleRequest,
} from '../lib/api'

function emptyForm() {
  return { username: '', password: '', role: 'user' }
}

function RoleSegment({ value, onChange, disabled, t }) {
  const options = [
    { id: 'user', label: t('auth.roleUser'), icon: UserRound },
    { id: 'admin', label: t('auth.roleAdmin'), icon: Shield },
  ]
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      {options.map(({ id, label, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${
              active
                ? id === 'admin'
                  ? 'bg-white text-teal-800 shadow-sm ring-1 ring-teal-500/15'
                  : 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            } disabled:opacity-50`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

function UserAvatar({ username, role }) {
  const initial = (username || '?').slice(0, 1).toUpperCase()
  const isAdmin = role === 'admin'
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
        isAdmin
          ? 'bg-teal-500/15 text-teal-700 ring-1 ring-inset ring-teal-500/20'
          : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
      }`}
    >
      {initial}
    </div>
  )
}

function RowMenu({ open, onOpenChange, items, label }) {
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    function place() {
      const rect = btnRef.current.getBoundingClientRect()
      const menuW = 184
      const menuH = Math.min(items.length * 42 + 8, 220)
      const gap = 6
      let top = rect.bottom + gap
      let left = rect.right - menuW
      if (left < 8) left = 8
      if (left + menuW > window.innerWidth - 8) {
        left = window.innerWidth - menuW - 8
      }
      if (top + menuH > window.innerHeight - 8) {
        top = rect.top - menuH - gap
      }
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      const t = e.target
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      onOpenChange(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
          open
            ? 'bg-slate-900 text-white'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[80] min-w-[11.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/15"
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    onOpenChange(false)
                    item.onClick()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition disabled:opacity-40 ${
                    item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export default function AdminUsersPanel() {
  const { user, refreshUser } = useAuth()
  const { t } = useI18n()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [passwordEdits, setPasswordEdits] = useState({})
  const [roleEdits, setRoleEdits] = useState({})
  /** null | { id, mode: 'edit' | 'password' } */
  const [panel, setPanel] = useState(null)
  const [menuFor, setMenuFor] = useState(null)

  const counts = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin').length
    return { total: users.length, admins, members: users.length - admins }
  }, [users])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchUsers()
      setUsers(data.users || [])
    } catch (err) {
      setError(err.message || t('auth.adminLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  function openPanel(id, mode) {
    setMenuFor(null)
    if (mode === 'edit') {
      const current = users.find((u) => u.id === id)
      setRoleEdits((prev) => ({ ...prev, [id]: current?.role || 'user' }))
    }
    setPanel({ id, mode })
  }

  function closePanel() {
    setPanel(null)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await createUserRequest(form)
      setForm(emptyForm())
      setMessage(t('auth.userCreated'))
      await load()
    } catch (err) {
      setError(err.message || t('auth.adminSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handlePassword(id) {
    const password = passwordEdits[id] || ''
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await updateUserPasswordRequest(id, password)
      setPasswordEdits((prev) => ({ ...prev, [id]: '' }))
      closePanel()
      setMessage(t('auth.passwordUpdated'))
      if (id === user?.id) await refreshUser()
    } catch (err) {
      setError(err.message || t('auth.adminSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveRole(id) {
    const role = roleEdits[id]
    if (!role || users.find((u) => u.id === id)?.role === role) {
      closePanel()
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await updateUserRoleRequest(id, role)
      setMessage(t('auth.roleUpdated'))
      closePanel()
      await load()
      if (id === user?.id) await refreshUser()
    } catch (err) {
      setError(err.message || t('auth.adminSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id, username) {
    if (!confirm(t('auth.deleteConfirm', { name: username }))) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await deleteUserRequest(id)
      if (panel?.id === id) closePanel()
      setMessage(t('auth.userDeleted'))
      await load()
    } catch (err) {
      setError(err.message || t('auth.adminSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {(error || message) && (
        <div
          className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            error
              ? 'bg-red-50 text-red-800 ring-1 ring-red-100'
              : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
          }`}
          role="status"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80">
            {error ? (
              <X className="h-3.5 w-3.5 text-red-600" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </span>
          <p className="min-w-0 flex-1 leading-relaxed">{error || message}</p>
          <button
            type="button"
            onClick={() => {
              setError('')
              setMessage('')
            }}
            className="shrink-0 rounded-lg p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
            aria-label={t('common.cancel')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700">
              <Plus className="h-4 w-4" />
            </span>
            {t('auth.createUser')}
          </h2>
          <p className="mt-1.5 pl-10 text-sm text-slate-500">
            {t('auth.createUserHint')}
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
                {t('auth.username')}
              </label>
              <input
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder={t('auth.username')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
                {t('auth.password')}
              </label>
              <PasswordInput
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                autoComplete="new-password"
                required
                minLength={6}
                className="!rounded-xl !border-slate-200 !bg-slate-50/50 !py-2.5 focus:!bg-white"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
                {t('auth.role')}
              </label>
              <RoleSegment
                value={form.role}
                onChange={(role) => setForm((f) => ({ ...f, role }))}
                disabled={busy}
                t={t}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {t('auth.createUser')}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {t('auth.userList')}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {loading
                ? t('auth.loading')
                : t('auth.userStats', {
                    total: counts.total,
                    admins: counts.admins,
                  })}
            </p>
          </div>
          {!loading && counts.total > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800 ring-1 ring-teal-100">
                <Shield className="h-3 w-3" />
                {counts.admins}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
                <UserRound className="h-3 w-3" />
                {counts.members}
              </span>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('auth.loading')}
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <UserRound className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {t('auth.emptyUsers')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t('auth.createUserHint')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => {
              const isYou = u.id === user?.id
              const editing = panel?.id === u.id && panel.mode === 'edit'
              const pwdOpen = panel?.id === u.id && panel.mode === 'password'
              const menuItems = [
                {
                  id: 'edit',
                  label: t('common.edit'),
                  icon: <Pencil className="h-4 w-4 shrink-0" />,
                  onClick: () => openPanel(u.id, 'edit'),
                  disabled: busy,
                },
                {
                  id: 'password',
                  label: t('auth.changePassword'),
                  icon: <KeyRound className="h-4 w-4 shrink-0" />,
                  onClick: () => openPanel(u.id, 'password'),
                  disabled: busy,
                },
              ]
              if (!isYou) {
                menuItems.push({
                  id: 'delete',
                  label: t('common.delete'),
                  icon: <Trash2 className="h-4 w-4 shrink-0" />,
                  onClick: () => handleDelete(u.id, u.username),
                  disabled: busy,
                  danger: true,
                })
              }

              return (
                <li key={u.id} className="px-5 py-4 sm:px-6">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar username={u.username} role={u.role} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {u.username}
                        </p>
                        {isYou ? (
                          <p className="mt-0.5 text-xs text-amber-700">
                            {t('auth.you')}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <span
                      className={`inline-flex w-fit items-center gap-1.5 justify-self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:justify-self-end ${
                        u.role === 'admin'
                          ? 'bg-teal-500/15 text-teal-800 ring-1 ring-teal-500/20'
                          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                      }`}
                    >
                      {u.role === 'admin' ? (
                        <Shield className="h-3.5 w-3.5" />
                      ) : (
                        <UserRound className="h-3.5 w-3.5" />
                      )}
                      {u.role === 'admin'
                        ? t('auth.roleAdmin')
                        : t('auth.roleUser')}
                    </span>

                    <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3">
                      <RowMenu
                        open={menuFor === u.id}
                        onOpenChange={(next) =>
                          setMenuFor(next ? u.id : null)
                        }
                        label={t('common.more')}
                        items={menuItems}
                      />
                    </div>
                  </div>

                  {editing ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
                      <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <Pencil className="h-3.5 w-3.5" />
                        {t('auth.role')}
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1 sm:max-w-xs">
                          <RoleSegment
                            value={roleEdits[u.id] || u.role}
                            onChange={(role) =>
                              setRoleEdits((prev) => ({
                                ...prev,
                                [u.id]: role,
                              }))
                            }
                            disabled={busy}
                            t={t}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSaveRole(u.id)}
                            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40 sm:flex-none"
                          >
                            {t('common.save')}
                          </button>
                          <button
                            type="button"
                            onClick={closePanel}
                            className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {pwdOpen ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
                      <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <KeyRound className="h-3.5 w-3.5" />
                        {t('auth.newPassword')}
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <PasswordInput
                            value={passwordEdits[u.id] || ''}
                            onChange={(e) =>
                              setPasswordEdits((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                            placeholder="••••••••"
                            autoComplete="new-password"
                            className="!rounded-xl !border-slate-200 !bg-white !py-2.5"
                            minLength={6}
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={
                              busy || !(passwordEdits[u.id] || '').trim()
                            }
                            onClick={() => handlePassword(u.id)}
                            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40 sm:flex-none"
                          >
                            {t('auth.setPassword')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closePanel()
                              setPasswordEdits((prev) => ({
                                ...prev,
                                [u.id]: '',
                              }))
                            }}
                            className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-white hover:text-slate-800"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
