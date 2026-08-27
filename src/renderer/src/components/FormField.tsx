import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

/**
 * Bọc một ô nhập kèm nhãn, dấu bắt buộc và chỗ hiện lỗi ngay bên dưới.
 * Gom vào một component để mọi form trong ứng dụng báo lỗi giống hệt nhau.
 */
function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children
}: FormFieldProps): React.JSX.Element {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="form-field__required">*</span>}
      </label>
      {children}
      {error ? (
        <span className="form-field__error">{error}</span>
      ) : (
        hint && <span className="form-field__hint">{hint}</span>
      )}
    </div>
  )
}

export default FormField
