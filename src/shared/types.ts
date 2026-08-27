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
