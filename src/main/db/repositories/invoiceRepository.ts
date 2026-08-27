import { getDb } from '../connection'
import type { PaymentMethod } from '../../../shared/constants'
import type { Invoice, InvoiceItem, InvoiceWithItems } from '../../../shared/types'
import type {
  InvoiceListFilter,
  InvoiceListResult,
  InvoiceListRow
} from '../../../shared/reportTypes'

/**
 * Sinh mã hóa đơn dạng HD20260827-0001.
 *
 * Cách làm: đếm số hóa đơn đã lập trong ngày rồi cộng 1. Hàm này BẮT BUỘC phải
 * được gọi bên trong transaction của checkout — nếu gọi ngoài, hai thu ngân bấm
 * thanh toán cùng lúc có thể cùng đọc ra số 5 và cùng sinh mã HD…-0005, khiến
 * một trong hai bị lỗi vì cột invoice_code có ràng buộc UNIQUE.
 */
export function nextInvoiceCode(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const datePart = `${y}${m}${d}`

  const row = getDb()
    .prepare<[string], { total: number }>(
      `SELECT COUNT(*) AS total FROM invoices WHERE invoice_code LIKE ?`
    )
    .get(`HD${datePart}-%`)

  const sequence = String((row?.total ?? 0) + 1).padStart(4, '0')
  return `HD${datePart}-${sequence}`
}

interface CreateInvoiceParams {
  invoice_code: string
  user_id: number
  subtotal: number
  discount: number
  total: number
  payment_method: PaymentMethod
  customer_paid: number
  change_amount: number
}

export function insertInvoice(params: CreateInvoiceParams): number {
  const info = getDb()
    .prepare(
      `INSERT INTO invoices
         (invoice_code, user_id, subtotal, discount, total,
          payment_method, customer_paid, change_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.invoice_code,
      params.user_id,
      params.subtotal,
      params.discount,
      params.total,
      params.payment_method,
      params.customer_paid,
      params.change_amount
    )
  return Number(info.lastInsertRowid)
}

export function insertInvoiceItem(
  invoiceId: number,
  productId: number,
  productName: string,
  quantity: number,
  unitPrice: number
): void {
  getDb()
    .prepare(
      `INSERT INTO invoice_items
         (invoice_id, product_id, product_name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(invoiceId, productId, productName, quantity, unitPrice, quantity * unitPrice)
}

/**
 * Trừ tồn kho một cách an toàn.
 *
 * Điều kiện `AND stock >= ?` ngay trong câu UPDATE là chốt chặn cuối cùng:
 * nếu tồn kho không đủ thì câu lệnh không sửa dòng nào (changes = 0) và ta ném
 * lỗi để hủy cả transaction. Nhờ vậy tồn kho không bao giờ bị âm, kể cả khi hai
 * máy bán hàng cùng bán món cuối cùng đúng một lúc.
 */
export function decreaseStock(productId: number, quantity: number): void {
  const info = getDb()
    .prepare(`UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`)
    .run(quantity, productId, quantity)

  if (info.changes === 0) {
    throw new Error('Tồn kho đã thay đổi, không đủ hàng để bán')
  }
}

export function findById(id: number): Invoice | undefined {
  return getDb()
    .prepare<[number], Invoice>(`SELECT * FROM invoices WHERE id = ?`)
    .get(id)
}

export function findItems(invoiceId: number): InvoiceItem[] {
  return getDb()
    .prepare<[number], InvoiceItem>(
      `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id`
    )
    .all(invoiceId)
}

/** Lấy hóa đơn đầy đủ kèm chi tiết và tên thu ngân — dùng để in. */
export function findWithItems(id: number): InvoiceWithItems | undefined {
  const invoice = getDb()
    .prepare<[number], Invoice & { cashier_name: string }>(
      `SELECT i.*, u.full_name AS cashier_name
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`
    )
    .get(id)

  if (!invoice) return undefined
  return { ...invoice, items: findItems(id) }
}

/* ------------------------------------------------------------------ */
/* Tra cứu lịch sử hóa đơn                                             */
/* ------------------------------------------------------------------ */

/**
 * Dựng phần WHERE dùng chung cho cả câu đếm và câu lấy dữ liệu.
 *
 * created_at được lưu dạng chuỗi "YYYY-MM-DD HH:MM:SS" nên so sánh chuỗi thông
 * thường đã cho đúng thứ tự thời gian — không cần hàm chuyển kiểu ngày tháng.
 * Ngày kết thúc phải nối thêm " 23:59:59", nếu chỉ so tới " 00:00:00" thì các
 * hóa đơn lập trong ngày cuối sẽ bị bỏ sót.
 */
function buildWhere(filter: InvoiceListFilter): { clause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.from) {
    conditions.push('i.created_at >= ?')
    params.push(`${filter.from} 00:00:00`)
  }
  if (filter.to) {
    conditions.push('i.created_at <= ?')
    params.push(`${filter.to} 23:59:59`)
  }
  if (filter.keyword?.trim()) {
    conditions.push('i.invoice_code LIKE ? COLLATE NOCASE')
    params.push(`%${filter.keyword.trim()}%`)
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

/** Lấy danh sách hóa đơn có phân trang, kèm tổng số bản ghi và tổng doanh thu. */
export function list(filter: InvoiceListFilter): InvoiceListResult {
  const db = getDb()
  const { clause, params } = buildWhere(filter)
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 200)
  const offset = Math.max(filter.offset ?? 0, 0)

  const summary = db
    .prepare<unknown[], { total: number; revenue: number | null }>(
      `SELECT COUNT(*) AS total, SUM(i.total) AS revenue FROM invoices i ${clause}`
    )
    .get(...params)

  const rows = db
    .prepare<unknown[], InvoiceListRow>(
      `SELECT i.*,
              u.full_name AS cashier_name,
              (SELECT COUNT(*) FROM invoice_items it WHERE it.invoice_id = i.id) AS item_count
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       ${clause}
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)

  return {
    rows,
    total: summary?.total ?? 0,
    totalRevenue: summary?.revenue ?? 0
  }
}
