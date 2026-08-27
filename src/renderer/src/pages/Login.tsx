import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Icon from '../components/Icon'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

interface FieldErrors {
  username?: string
  password?: string
}

/**
 * Màn hình đăng nhập.
 *
 * Cách hiển thị lỗi được chia làm hai mức:
 *  - Lỗi từng ô (bỏ trống, quá ngắn) hiện ngay dưới ô đó, kiểm tra ở giao diện.
 *  - Lỗi đăng nhập sai hiện ở khung đỏ phía trên, do main process trả về.
 * Không dùng alert() vì hộp thoại mặc định của trình duyệt chặn cả cửa sổ và
 * trông không giống phần mềm bán hàng chuyên nghiệp.
 */
function Login(): React.JSX.Element {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  /** Kiểm tra dữ liệu ngay tại giao diện trước khi gọi xuống main process. */
  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!username.trim()) errors.username = 'Vui lòng nhập tên đăng nhập'
    if (!password) errors.password = 'Vui lòng nhập mật khẩu'
    else if (password.length < 4) errors.password = 'Mật khẩu phải có ít nhất 4 ký tự'

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    const error = await login(username, password)
    setSubmitting(false)

    if (error) {
      setFormError(error)
      setPassword('')
      usernameRef.current?.focus()
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit} noValidate>
        <div className="login__brand">
          <div className="login__logo">POS</div>
          <h1 className="login__title">Phần mềm bán hàng</h1>
          <p className="login__subtitle">Đăng nhập để bắt đầu ca làm việc</p>
        </div>

        {formError && (
          <div className="login__alert" role="alert">
            <Icon name="warning" size={18} />
            <span>{formError}</span>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="username">
            Tên đăng nhập
          </label>
          <div className="field__control">
            <Icon name="user" size={18} className="field__icon" />
            <input
              id="username"
              ref={usernameRef}
              className={`field__input ${fieldErrors.username ? 'field__input--error' : ''}`}
              type="text"
              value={username}
              autoFocus
              autoComplete="username"
              placeholder="admin"
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {fieldErrors.username && (
            <span className="field__error">{fieldErrors.username}</span>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="password">
            Mật khẩu
          </label>
          <div className="field__control">
            <Icon name="lock" size={18} className="field__icon" />
            <input
              id="password"
              className={`field__input ${fieldErrors.password ? 'field__input--error' : ''}`}
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder="••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {fieldErrors.password && (
            <span className="field__error">{fieldErrors.password}</span>
          )}
        </div>

        <button className="login__submit" type="submit" disabled={submitting}>
          {submitting ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>

        <p className="login__hint">
          Tài khoản mặc định:
          <br />
          Quản trị viên — <code>admin</code> / <code>123456</code>
          <br />
          Thu ngân — <code>thungan</code> / <code>123456</code>
        </p>
      </form>
    </div>
  )
}

export default Login
