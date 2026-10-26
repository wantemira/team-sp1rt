import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createCreditApi } from '../api/creditApi'
import { Button, InlineAlert, LoadingState } from '../components/ui'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem('token')))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const api = useMemo(() => createCreditApi({
    getToken: () => sessionStorage.getItem('token'),
    onUnauthorized: () => {
      sessionStorage.removeItem('token')
      setSession(null)
    },
  }), [])

  useEffect(() => {
    if (!sessionStorage.getItem('token')) return
    const controller = new AbortController()
    api.me(controller.signal).then(data => {
      setSession(data)
      setError('')
    }).catch(err => {
      if (err.name !== 'AbortError' && err.status !== 401) setError('Не удалось восстановить сессию. Проверьте соединение с сервером.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [api, attempt])

  async function login(email, password) {
    const data = await api.login({ email, password })
    sessionStorage.setItem('token', data.access_token)
    sessionStorage.removeItem('fake_user')
    setSession(data)
    setError('')
    return data.user.role
  }
  function logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('fake_user')
    setSession(null)
    setError('')
  }
  if (loading) return <LoadingState label="Проверяем сессию…" />
  if (error) return <InlineAlert tone="danger" title={error}>
    <Button onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Повторить</Button>
    <Button variant="secondary" onClick={logout}>Вернуться ко входу</Button>
  </InlineAlert>
  const user = session ? {
    ...session.user,
    name: session.client?.company_name || session.employee?.full_name || session.user.email,
    company_name: session.client?.company_name,
  } : null
  return <AuthContext.Provider value={{ user, client: session?.client, employee: session?.employee, login, logout, api }}>
    {children}
  </AuthContext.Provider>
}

// Контекст и компоненты используют одно состояние сессии.
// eslint-disable-next-line react/only-export-components
export const useAuth = () => useContext(AuthContext)
