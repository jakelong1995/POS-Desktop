import Icon from './Icon'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Hộp thoại xác nhận trước các hành động không lấy lại được
 * (xóa sản phẩm, hủy giỏ hàng…).
 *
 * Dùng component riêng thay cho window.confirm() vì hộp thoại mặc định của
 * trình duyệt không đổi được chữ sang tiếng Việt, không tùy biến được màu sắc,
 * và nó chặn cứng toàn bộ tiến trình giao diện trong lúc hiển thị.
 */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  tone = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      title={title}
      width={460}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm__body">
        <div className={`confirm__icon confirm__icon--${tone}`}>
          <Icon name="warning" size={22} />
        </div>
        <p className="confirm__message">{message}</p>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
