import type { PaymentMethod, Role } from './constants'

/**
 * Các kiểu dữ liệu dùng chung cho cả main process và renderer.
 * File này KHÔNG import bất cứ thứ gì của Node hay của DOM,
 * vì nó được nạp ở cả hai phía.
 */

/**
 * Dạng phản hồi thống nhất của mọi handler IPC.
 * Renderer luôn nhận được object này, không bao giờ nhận exception,
 * nhờ vậy giao diện có thể hiển thị lỗi tiếng Việt thay vì bị crash.
 */
export type IpcResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

/* ------------------------------------------------------------------ */
/* Người dùng                                                          */
/* ------------------------------------------------------------------ */

/** Bản ghi user đầy đủ như trong bảng — CHỈ dùng bên trong main process. */
export interface UserRow {
  id: number
  username: string
  password_hash: string
  full_name: string
  role: Role
  created_at: string
}

/**
 * Thông tin người dùng được phép gửi sang renderer.
 * Cố tình bỏ password_hash để chuỗi băm không bao giờ rời khỏi main process.
 */
export interface PublicUser {
  id: number
  username: string
  full_name: string
  role: Role
  created_at: string
}

export interface LoginPayload {
  username: string
  password: string
}

/* ------------------------------------------------------------------ */
/* Danh mục và sản phẩm                                                */
/* ------------------------------------------------------------------ */

export interface Category {
  id: number
  name: string
  description: string | null
}

export interface Product {
  id: number
  sku: string
  barcode: string | null
  name: string
  category_id: number | null
  price: number
  cost: number
  stock: number
  unit: string
  image_path: string | null
  is_active: number
}

/** Sản phẩm kèm tên danh mục — kết quả của câu JOIN, dùng để hiển thị. */
export interface ProductWithCategory extends Product {
  category_name: string | null
}

/* ------------------------------------------------------------------ */
/* Hóa đơn                                                             */
/* ------------------------------------------------------------------ */

export interface Invoice {
  id: number
  invoice_code: string
  user_id: number
  subtotal: number
  discount: number
  total: number
  payment_method: PaymentMethod
  customer_paid: number
  change_amount: number
  created_at: string
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

/* ------------------------------------------------------------------ */
/* Trả hàng / hoàn tiền                                                */
/* ------------------------------------------------------------------ */

/** Trả một phần hay trả toàn bộ hóa đơn. */
export type RefundKind = 'partial' | 'full'

export interface Refund {
  id: number
  refund_code: string
  invoice_id: number
  user_id: number
  reason: string | null
  total: number
  /** 1 = đã nhập lại kho, 0 = hàng hỏng nên không nhập lại. */
  restock: number
  kind: RefundKind
  created_at: string
}

export interface RefundItem {
  id: number
  refund_id: number
  invoice_item_id: number
  product_id: number | null
  product_name: string
  quantity: number
  /** Đơn giá hoàn — đơn giá bán đã trừ phần giảm giá phân bổ cho dòng này. */
  unit_price: number
  line_total: number
}

/** Phiếu trả đầy đủ — dùng để in và xem lại. */
export interface RefundWithItems extends Refund {
  invoice_code: string
  cashier_name: string
  items: RefundItem[]
}

/**
 * Một dòng hóa đơn kèm thông tin đã trả bao nhiêu — dữ liệu dựng form trả hàng.
 * Renderer KHÔNG tự tính mấy con số này: chúng do main process tính từ database
 * để giao diện và số tiền thực hoàn không bao giờ lệch nhau.
 */
export interface RefundableLine extends InvoiceItem {
  /** Tổng số đã trả ở các phiếu trước. */
  refunded_quantity: number
  /** Số còn được phép trả = quantity − refunded_quantity. */
  remaining_quantity: number
  /** Đơn giá hoàn thực tế sau khi phân bổ giảm giá của hóa đơn. */
  effective_unit_price: number
}

/** Toàn bộ dữ liệu màn hình trả hàng cần, lấy trong đúng một lời gọi IPC. */
export interface RefundableInvoice {
  invoice: InvoiceWithItems
  lines: RefundableLine[]
  /** Tổng tiền đã hoàn ở các phiếu trước. */
  refunded_total: number
  /** Số tiền tối đa còn có thể hoàn = invoice.total − refunded_total. */
  refundable_total: number
  /** true khi mọi món đã được trả hết, không còn gì để trả nữa. */
  fully_refunded: boolean
  /** Các phiếu trả đã lập cho hóa đơn này, mới nhất trước. */
  refunds: Refund[]
}

export interface RefundItemPayload {
  invoice_item_id: number
  quantity: number
}

/**
 * Dữ liệu renderer gửi xuống khi lập phiếu trả.
 *
 * Giống thanh toán: KHÔNG gửi số tiền. Renderer chỉ nói "trả dòng nào, mấy
 * cái", còn số tiền hoàn do main process tính lại từ hóa đơn trong database.
 */
export interface RefundPayload {
  invoice_id: number
  items: RefundItemPayload[]
  reason?: string | null
  /** true = nhập lại kho. Hàng hỏng thì bỏ chọn để tồn kho không bị thổi phồng. */
  restock: boolean
}

/* ------------------------------------------------------------------ */
/* Giỏ hàng và thanh toán                                              */
/* ------------------------------------------------------------------ */

/** Một dòng trong giỏ hàng ở phía giao diện. */
export interface CartLine {
  product: ProductWithCategory
  quantity: number
}

/**
 * Dữ liệu renderer gửi xuống khi bấm thanh toán.
 *
 * Chú ý: CHỈ gửi product_id và số lượng, KHÔNG gửi đơn giá. Giá luôn được main
 * process đọc lại từ database. Nếu tin vào giá do renderer gửi lên thì người
 * dùng có thể mở DevTools sửa giá thành 0 đồng rồi "mua" hàng miễn phí.
 */
export interface CheckoutItem {
  product_id: number
  quantity: number
}

export interface CheckoutPayload {
  items: CheckoutItem[]
  discount: number
  payment_method: PaymentMethod
  customer_paid: number
}

/** Hóa đơn kèm chi tiết và tên thu ngân — dùng để in và xem lại. */
export interface InvoiceWithItems extends Invoice {
  cashier_name: string
  items: InvoiceItem[]
}
