const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
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

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data
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
