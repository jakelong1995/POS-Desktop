import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './useToast.css'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Thông báo dạng "bánh mì nướng" hiện ở góc dưới bên phải rồi tự biến mất.
 *
 * Dùng thay cho alert(): thu ngân đang bán hàng không nên bị chặn bởi một hộp
 * thoại phải bấm OK mới đóng được — thông báo tự tắt sau 4 giây, họ vẫn bấm
 * tiếp được ngay.
 */
export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, tone, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      info: (m: string) => push('info', m)
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải được dùng bên trong <ToastProvider>')
  return ctx
}
