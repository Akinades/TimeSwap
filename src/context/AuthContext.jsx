import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  loginRequest,
  setAuthToken,
  setUnauthorizedHandler,
} from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [postLoginPath, setPostLoginPath] = useState(null)

  const logout = useCallback(() => {
    clearAuthToken()
    setUser(null)
    setPostLoginPath(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setPostLoginPath(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const token = getAuthToken()
      if (!token) {
        if (!cancelled) {
          setUser(null)
          setReady(true)
        }
        return
      }
      try {
        const me = await fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        clearAuthToken()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  async function login(
    username,
    password,
    { adminOnly = false, redirectTo = null } = {},
  ) {
    const result = await loginRequest(username, password, { adminOnly })
    setAuthToken(result.token)
    setUser({
      id: result.id,
      username: result.username,
      role: result.role,
    })
    setPostLoginPath(redirectTo || null)
    return result
  }

  const consumePostLoginPath = useCallback(() => {
    const path = postLoginPath
    setPostLoginPath(null)
    return path
  }, [postLoginPath])

  const value = useMemo(
    () => ({
      ready,
      user,
      username: user?.username || null,
      role: user?.role || null,
      isAdmin: user?.role === 'admin',
      isAuthenticated: Boolean(user),
      postLoginPath,
      login,
      logout,
      consumePostLoginPath,
      refreshUser: async () => {
        const me = await fetchMe()
        setUser(me)
        return me
      },
    }),
    [ready, user, postLoginPath, logout, consumePostLoginPath],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
