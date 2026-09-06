import { getDb } from '../connection'
import type { Refund, RefundItem, RefundKind, RefundWithItems } from '../../../shared/types'
import type {
  RefundListFilter,
  RefundListResult,
  RefundListRow
} from '../../../shared/reportTypes'

/**
 * Sinh mã phiếu trả dạng TH20260906-0001 (TH = Trả Hàng).
 *
 * Cùng ràng buộc như nextInvoiceCode: BẮT BUỘC gọi bên trong transaction, vì
 * cách sinh mã là "đếm số phiếu trong ngày rồi cộng 1" — hai thu ngân lập phiếu
 * cùng lúc mà gọi ngoài transaction sẽ cùng đọc ra một số và đụng UNIQUE.
 */
export function nextRefundCode(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const datePart = `${y}${m}${d}`

  const row = getDb()
    .prepare<[string], { total: number }>(
      `SELECT COUNT(*) AS total FROM refunds WHERE refund_code LIKE ?`
    )
    .get(`TH${datePart}-%`)

  const sequence = String((row?.total ?? 0) + 1).padStart(4, '0')
  return `TH${datePart}-${sequence}`
}

interface CreateRefundParams {
  refund_code: string
  invoice_id: number
  user_id: number
  reason: string | null
  total: number
  restock: number
  kind: RefundKind
}

export function insertRefund(params: CreateRefundParams): number {
  const info = getDb()
    .prepare(
      `INSERT INTO refunds
         (refund_code, invoice_id, user_id, reason, total, restock, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.refund_code,
      params.invoice_id,
      params.user_id,
      params.reason,
      params.total,
      params.restock,
      params.kind
    )
  return Number(info.lastInsertRowid)
}

export function insertRefundItem(
  refundId: number,
  invoiceItemId: number,
  productId: number | null,
  productName: string,
  quantity: number,
  unitPrice: number,
  lineTotal: number
): void {
  getDb()
    .prepare(
      `INSERT INTO refund_items
         (refund_id, invoice_item_id, product_id, product_name,
          quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(refundId, invoiceItemId, productId, productName, quantity, unitPrice, lineTotal)
}

/**
 * Cộng trả tồn kho khi khách trả hàng còn dùng được.
 *
 * Không cần điều kiện bảo vệ như decreaseStock: cộng thêm thì tồn kho không thể
 * âm. Nhưng sản phẩm có thể đã bị xóa (product_id là NULL sau ON DELETE SET
 * NULL) nên hàm này chấp nhận trường hợp không sửa được dòng nào — tiền vẫn
 * hoàn cho khách, chỉ là không còn chỗ nào để cộng kho.
 */
export function increaseStock(productId: number, quantity: number): void {
  getDb().prepare(`UPDATE products SET stock = stock + ? WHERE id = ?`).run(quantity, productId)
}

/**
 * Số lượng đã trả của từng dòng hóa đơn, gom theo invoice_item_id.
 *
 * Đây là chốt chặn chống trả quá số đã mua: khách mua 3 hộp, trả 2 hôm qua thì
 * hôm nay chỉ được trả thêm 1. Truy vấn gộp cả các phiếu trả cũ nên dù trả làm
 * bao nhiêu lần, tổng cũng không bao giờ vượt số đã bán.
 */
export function refundedQuantities(invoiceId: number): Map<number, number> {
  const rows = getDb()
    .prepare<[number], { invoice_item_id: number; quantity: number }>(
      `SELECT ri.invoice_item_id       AS invoice_item_id,
              SUM(ri.quantity)         AS quantity
       FROM refund_items ri
       JOIN refunds r ON r.id = ri.refund_id
       WHERE r.invoice_id = ?
       GROUP BY ri.invoice_item_id`
    )
    .all(invoiceId)

  return new Map(rows.map((row) => [row.invoice_item_id, row.quantity]))
}

/** Tổng tiền đã hoàn của một hóa đơn. */
export function refundedTotal(invoiceId: number): number {
  const row = getDb()
    .prepare<[number], { total: number | null }>(
      `SELECT SUM(total) AS total FROM refunds WHERE invoice_id = ?`
    )
    .get(invoiceId)
  return row?.total ?? 0
}

/** Các phiếu trả của một hóa đơn, mới nhất trước. */
export function findByInvoice(invoiceId: number): Refund[] {
  return getDb()
    .prepare<[number], Refund>(
      `SELECT * FROM refunds WHERE invoice_id = ? ORDER BY created_at DESC, id DESC`
    )
    .all(invoiceId)
}

export function findItems(refundId: number): RefundItem[] {
  return getDb()
    .prepare<[number], RefundItem>(`SELECT * FROM refund_items WHERE refund_id = ? ORDER BY id`)
    .all(refundId)
}

/** Phiếu trả đầy đủ kèm chi tiết, mã hóa đơn gốc và tên người lập — dùng để in. */
export function findWithItems(id: number): RefundWithItems | undefined {
  const refund = getDb()
    .prepare<[number], Refund & { invoice_code: string; cashier_name: string }>(
      `SELECT r.*, i.invoice_code AS invoice_code, u.full_name AS cashier_name
       FROM refunds r
       JOIN invoices i ON i.id = r.invoice_id
       JOIN users    u ON u.id = r.user_id
       WHERE r.id = ?`
    )
    .get(id)

  if (!refund) return undefined
  return { ...refund, items: findItems(id) }
}

/* ------------------------------------------------------------------ */
/* Tra cứu lịch sử phiếu trả                                           */
/* ------------------------------------------------------------------ */

/** Giống buildWhere của hóa đơn, nhưng tìm được cả mã phiếu lẫn mã hóa đơn gốc. */
function buildWhere(filter: RefundListFilter): { clause: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.from) {
    conditions.push('r.created_at >= ?')
    params.push(`${filter.from} 00:00:00`)
  }
  if (filter.to) {
    conditions.push('r.created_at <= ?')
    params.push(`${filter.to} 23:59:59`)
  }
  if (filter.keyword?.trim()) {
    conditions.push('(r.refund_code LIKE ? COLLATE NOCASE OR i.invoice_code LIKE ? COLLATE NOCASE)')
    const like = `%${filter.keyword.trim()}%`
    params.push(like, like)
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

export function list(filter: RefundListFilter): RefundListResult {
  const db = getDb()
  const { clause, params } = buildWhere(filter)
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 200)
  const offset = Math.max(filter.offset ?? 0, 0)

  const summary = db
    .prepare<unknown[], { total: number; refund: number | null }>(
      `SELECT COUNT(*) AS total, SUM(r.total) AS refund
       FROM refunds r
       JOIN invoices i ON i.id = r.invoice_id
       ${clause}`
    )
    .get(...params)

  const rows = db
    .prepare<unknown[], RefundListRow>(
      `SELECT r.*,
              i.invoice_code AS invoice_code,
              u.full_name    AS cashier_name,
              (SELECT COUNT(*) FROM refund_items ri WHERE ri.refund_id = r.id) AS item_count
       FROM refunds r
       JOIN invoices i ON i.id = r.invoice_id
       JOIN users    u ON u.id = r.user_id
       ${clause}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)

  return {
    rows,
    total: summary?.total ?? 0,
    totalRefund: summary?.refund ?? 0
  }
}
