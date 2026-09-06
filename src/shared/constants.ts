/** Các hằng số nghiệp vụ dùng chung cho cả main và renderer. */

/** Vai trò người dùng. */
export const ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier'
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/** Nhãn tiếng Việt của vai trò, dùng để hiển thị lên giao diện. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Quản trị viên',
  cashier: 'Thu ngân'
}

/** Phương thức thanh toán. */
export const PAYMENT_METHODS = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  CARD: 'card'
} as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  card: 'Thẻ'
}

/** Lý do trả hàng gợi ý sẵn — thu ngân bấm chọn thay vì gõ tay cho nhanh. */
export const REFUND_REASONS = [
  'Khách đổi ý',
  'Hàng lỗi / hỏng',
  'Sai sản phẩm',
  'Hết hạn sử dụng',
  'Thu ngân bấm nhầm'
] as const

/** Nhãn tiếng Việt của loại phiếu trả. */
export const REFUND_KIND_LABELS: Record<'partial' | 'full', string> = {
  partial: 'Trả một phần',
  full: 'Trả toàn bộ'
}

/**
 * Quá số ngày này thì không cho trả hàng nữa.
 * Con số phải khớp với dòng "Hàng mua rồi vui lòng đổi trong 7 ngày" in ở cuối
 * hóa đơn — nếu lệch nhau thì cửa hàng hứa một đằng, phần mềm chặn một nẻo.
 */
export const REFUND_WINDOW_DAYS = 7

/** Dưới ngưỡng này thì sản phẩm bị coi là sắp hết hàng và hiện cảnh báo. */
export const LOW_STOCK_THRESHOLD = 10

/** Tên file cơ sở dữ liệu đặt trong thư mục userData của ứng dụng. */
export const DB_FILE_NAME = 'pos.db'
