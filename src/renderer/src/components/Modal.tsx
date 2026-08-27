import { useEffect } from 'react'
import type { ReactNode } from 'react'
import './Modal.css'

interface ModalProps {
  open: boolean
  title: string
  width?: number
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * Hộp thoại dùng chung.
 *
 * Hai chi tiết nhỏ nhưng quan trọng khi dùng trên máy bán hàng:
 *  - Nhấn ESC là đóng, thu ngân không phải rời tay khỏi bàn phím tìm chuột.
 *  - Khi hộp thoại mở thì khoá cuộn trang nền, tránh cảnh bấm nhầm ra sau lưng.
 */
function Modal({ open, title, width, onClose, children, footer }: ModalProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return

    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        // Chỉ đóng khi bấm đúng vào nền mờ, không đóng khi bấm bên trong hộp thoại
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        style={width ? ({ '--modal-w': `${width}px` } as React.CSSProperties) : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal
