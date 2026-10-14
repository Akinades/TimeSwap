const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const TOKEN_KEY = 'timeswap-auth-token'

let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function clearAuthToken() {
  setAuthToken('')
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (res.status === 401) {
    clearAuthToken()
    onUnauthorized?.()
    throw new Error(data?.error || 'Unauthorized')
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data
}

export function loginRequest(username, password, { adminOnly = false } = {}) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, adminOnly }),
  })
}

export function fetchMe() {
  return request('/auth/me')
}

export function fetchUsers() {
  return request('/admin/users')
}

export function createUserRequest(payload) {
  return request('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUserPasswordRequest(id, password) {
  return request(`/admin/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password }),
  })
}

export function updateUserRoleRequest(id, role) {
  return request(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function deleteUserRequest(id) {
  return request(`/admin/users/${id}`, { method: 'DELETE' })
}

export function fetchWorkspace() {
  return request('/workspace')
}

export function saveWorkspace(workspace) {
  return request('/workspace', {
    method: 'PUT',
    body: JSON.stringify({
      companies: workspace.companies ?? [],
      activeCompanyId: workspace.activeCompanyId ?? null,
    }),
  })
}
