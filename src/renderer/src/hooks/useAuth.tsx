import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ROLES } from '@shared/constants'
import type { PublicUser } from '@shared/types'

interface AuthContextValue {
  user: PublicUser | null
  isAdmin: boolean
  /** Trả về null nếu đăng nhập thành công, hoặc câu thông báo lỗi tiếng Việt. */
  login: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Quản lý phiên đăng nhập ở phía giao diện.
 *
 * Bản sao thông tin người dùng ở đây CHỈ dùng để hiện/ẩn menu và chào tên.
 * Quyền thật sự luôn được main process kiểm tra lại ở mỗi lời gọi IPC,
 * nên sửa biến này trong DevTools cũng không truy cập được dữ liệu cấm.
 */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<PublicUser | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    const res = await window.api.auth.login({ username, password })
    if (!res.success) return res.error
    setUser(res.data)
    return null
  }, [])

  const logout = useCallback(async () => {
    await window.api.auth.logout()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAdmin: user?.role === ROLES.ADMIN, login, logout }),
    [user, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return ctx
}
