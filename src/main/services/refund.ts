import { getDb } from '../db/connection'
import * as invoiceRepo from '../db/repositories/invoiceRepository'
import * as refundRepo from '../db/repositories/refundRepository'
import { REFUND_WINDOW_DAYS, ROLES } from '../../shared/constants'
import type {
  RefundKind,
  RefundPayload,
  RefundWithItems,
  RefundableInvoice,
  RefundableLine,
  PublicUser,
  InvoiceWithItems
} from '../../shared/types'

/**
 * ============================================================================
 * NGHIỆP VỤ TRẢ HÀNG — hoàn tiền một phần hoặc toàn bộ hóa đơn
 * ============================================================================
 *
 * Trả hàng là nghiệp vụ ngược của thanh toán, và cũng phải nằm trọn trong MỘT
 * transaction: ghi phiếu trả, ghi chi tiết, cộng lại tồn kho — hoặc cả ba cùng
 * thành công, hoặc không gì xảy ra. Nếu ghi phiếu xong mới mất điện mà kho chưa
 * cộng lại thì cửa hàng vừa mất tiền hoàn cho khách, vừa mất luôn món hàng trên
 * sổ sách.
 *
 * Ba bài toán khó của nghiệp vụ này, giải trong file:
 *   1. Phân bổ giảm giá — xem hàm effectiveUnitPrice bên dưới.
 *   2. Chống trả quá số đã mua, kể cả khi trả làm nhiều đợt.
 *   3. Làm tròn: tổng các đợt trả phải khớp tuyệt đối với tiền khách đã trả.
 *
 * Nguyên tắc bảo mật giống thanh toán: renderer chỉ gửi lên "dòng nào, mấy
 * cái"; MỌI con số tiền đều được tính lại từ hóa đơn trong database.
 */

/**
 * Đơn giá hoàn thực tế của một dòng, sau khi phân bổ giảm giá của hóa đơn.
 *
 * Vì sao KHÔNG hoàn thẳng unit_price? Giả sử khách mua 2 món, tạm tính
 * 100.000 đ, được giảm 20.000 đ nên chỉ trả 80.000 đ. Nếu trả một món giá
 * niêm yết 50.000 đ mà hoàn đủ 50.000 đ thì cửa hàng hoàn nhiều hơn phần khách
 * thực trả cho món đó (chỉ 40.000 đ) — trả hết cả hai món là cửa hàng lỗ đúng
 * bằng số tiền đã giảm giá.
 *
 * Cách phân bổ: mỗi đồng của tạm tính được giảm cùng một tỷ lệ total/subtotal,
 * nên món đắt gánh phần giảm giá nhiều hơn món rẻ — đúng theo cảm nhận thông
 * thường của khách hàng.
 */
function effectiveUnitPrice(unitPrice: number, subtotal: number, total: number): number {
  if (subtotal <= 0) return 0
  return Math.round((unitPrice * total) / subtotal)
}

/** Số ngày đã trôi qua kể từ lúc lập hóa đơn. */
function daysSince(createdAt: string): number {
  const created = new Date(createdAt.replace(' ', 'T'))
  if (Number.isNaN(created.getTime())) return 0
  return Math.floor((Date.now() - created.getTime()) / 86_400_000)
}

function loadInvoiceOrThrow(invoiceId: number): InvoiceWithItems {
  const invoice = invoiceRepo.findWithItems(invoiceId)
  if (!invoice) throw new Error('Không tìm thấy hóa đơn cần trả hàng')
  return invoice
}

/**
 * Dựng dữ liệu cho màn hình trả hàng: từng dòng còn trả được bao nhiêu, đơn giá
 * hoàn là bao nhiêu, hóa đơn đã hoàn tổng cộng bao nhiêu.
 *
 * Gom hết vào một lời gọi IPC thay vì để giao diện tự ghép từ nhiều nguồn — như
 * vậy con số hiện trên màn hình chắc chắn là con số main process sẽ dùng khi
 * ghi phiếu, không có chỗ cho hai bên tính lệch nhau.
 */
export function prepareRefund(invoiceId: number): RefundableInvoice {
  const invoice = loadInvoiceOrThrow(invoiceId)
  const refunded = refundRepo.refundedQuantities(invoiceId)
  const refundedTotal = refundRepo.refundedTotal(invoiceId)

  const lines: RefundableLine[] = invoice.items.map((item) => {
    const refundedQty = refunded.get(item.id) ?? 0
    return {
      ...item,
      refunded_quantity: refundedQty,
      remaining_quantity: item.quantity - refundedQty,
      effective_unit_price: effectiveUnitPrice(item.unit_price, invoice.subtotal, invoice.total)
    }
  })

  return {
    invoice,
    lines,
    refunded_total: refundedTotal,
    refundable_total: Math.max(0, invoice.total - refundedTotal),
    fully_refunded: lines.every((line) => line.remaining_quantity <= 0),
    refunds: refundRepo.findByInvoice(invoiceId)
  }
}

/** Gộp các dòng trùng invoice_item_id rồi bỏ những dòng số lượng 0. */
function normalizeItems(payload: RefundPayload): Map<number, number> {
  const merged = new Map<number, number>()

  for (const item of payload.items ?? []) {
    const quantity = Math.round(item.quantity ?? 0)
    if (quantity === 0) continue
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error('Số lượng trả phải là số nguyên không âm')
    }
    merged.set(item.invoice_item_id, (merged.get(item.invoice_item_id) ?? 0) + quantity)
  }

  return merged
}

/**
 * Lập phiếu trả hàng.
 *
 * Trả một phần hay trả toàn bộ dùng CHUNG một đường đi: "trả toàn bộ" chỉ là
 * trường hợp mọi dòng đều trả hết số còn lại. Nhờ vậy không có hai nhánh mã
 * nguồn song song để rồi sửa nhánh này quên nhánh kia.
 */
export function createRefund(payload: RefundPayload, staff: PublicUser): RefundWithItems {
  const db = getDb()

  const requested = normalizeItems(payload)
  if (requested.size === 0) {
    throw new Error('Chưa chọn sản phẩm nào để trả')
  }

  const runRefund = db.transaction((): number => {
    // Đọc lại hóa đơn và số đã trả NGAY TRONG transaction. Đọc ở ngoài thì giữa
    // lúc đọc và lúc ghi có thể có phiếu trả khác chen vào, và hai phiếu cộng
    // lại sẽ trả nhiều hơn số khách đã mua.
    const invoice = loadInvoiceOrThrow(payload.invoice_id)
    const refundedQty = refundRepo.refundedQuantities(invoice.id)
    const refundedTotal = refundRepo.refundedTotal(invoice.id)

    // ---- Kiểm tra thời hạn đổi trả ----
    // Quản trị viên được phép vượt hạn để xử lý trường hợp ngoại lệ, nhưng thu
    // ngân thì không — nếu ai cũng vượt được thì quy định 7 ngày chỉ là hình thức.
    const age = daysSince(invoice.created_at)
    if (age > REFUND_WINDOW_DAYS && staff.role !== ROLES.ADMIN) {
      throw new Error(
        `Hóa đơn đã lập ${age} ngày, quá hạn đổi trả ${REFUND_WINDOW_DAYS} ngày — ` +
          `cần quản trị viên duyệt`
      )
    }

    // ---- Đối chiếu từng dòng với hóa đơn gốc ----
    const itemsById = new Map(invoice.items.map((item) => [item.id, item]))

    const lines = [...requested.entries()].map(([invoiceItemId, quantity]) => {
      const item = itemsById.get(invoiceItemId)
      if (!item) {
        throw new Error('Có dòng không thuộc hóa đơn này, vui lòng mở lại phiếu trả')
      }

      const already = refundedQty.get(invoiceItemId) ?? 0
      const remaining = item.quantity - already

      if (remaining <= 0) {
        throw new Error(`Sản phẩm "${item.product_name}" đã được trả hết ở phiếu trước`)
      }
      if (quantity > remaining) {
        throw new Error(
          `Sản phẩm "${item.product_name}" chỉ còn ${remaining} có thể trả, ` +
            `không trả được ${quantity}`
        )
      }

      const unitPrice = effectiveUnitPrice(item.unit_price, invoice.subtotal, invoice.total)
      return {
        item,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
        /** Dòng này có được trả hết phần còn lại hay không. */
        clearsLine: quantity === remaining
      }
    })

    // ---- Trả một phần hay trả toàn bộ? ----
    // "Toàn bộ" nghĩa là sau phiếu này hóa đơn không còn gì để trả nữa: mọi
    // dòng hoặc đã trả hết từ trước, hoặc được trả nốt trong phiếu này.
    const clearedIds = new Set(lines.filter((line) => line.clearsLine).map((line) => line.item.id))
    const clearsInvoice = invoice.items.every((item) => {
      const already = refundedQty.get(item.id) ?? 0
      return already >= item.quantity || clearedIds.has(item.id)
    })
    const kind: RefundKind = clearsInvoice ? 'full' : 'partial'

    // ---- Số tiền hoàn, có xử lý sai số làm tròn ----
    // Đơn giá hoàn là kết quả của một phép chia có làm tròn, nên cộng dồn nhiều
    // dòng qua nhiều đợt trả có thể lệch vài đồng so với số khách đã trả. Với
    // phiếu trả nốt, ta CHỐT thẳng bằng phần tiền còn lại của hóa đơn thay vì
    // lấy tổng đã tính — nhờ vậy tổng mọi phiếu trả luôn khớp tuyệt đối với
    // invoice.total, báo cáo doanh thu thuần không bao giờ dư ra vài đồng lẻ.
    const computed = lines.reduce((sum, line) => sum + line.lineTotal, 0)
    const remainingMoney = Math.max(0, invoice.total - refundedTotal)
    let total = clearsInvoice ? remainingMoney : computed

    // Chốt chặn cuối: dù tính kiểu gì cũng không hoàn quá số khách đã trả.
    if (total > remainingMoney) total = remainingMoney

    // ---- Ghi phiếu, ghi chi tiết, cộng lại kho ----
    const restock = payload.restock ? 1 : 0
    const reason = payload.reason?.trim() || null

    const refundId = refundRepo.insertRefund({
      refund_code: refundRepo.nextRefundCode(),
      invoice_id: invoice.id,
      user_id: staff.id,
      reason,
      total,
      restock,
      kind
    })

    for (const line of lines) {
      refundRepo.insertRefundItem(
        refundId,
        line.item.id,
        line.item.product_id,
        line.item.product_name,
        line.quantity,
        line.unitPrice,
        line.lineTotal
      )

      // product_id có thể NULL nếu sản phẩm đã bị xóa khỏi danh mục — khi đó
      // vẫn hoàn tiền cho khách, chỉ là không còn dòng tồn kho nào để cộng vào.
      if (restock && line.item.product_id !== null) {
        refundRepo.increaseStock(line.item.product_id, line.quantity)
      }
    }

    return refundId
  })

  const refundId = runRefund()

  const refund = refundRepo.findWithItems(refundId)
  if (!refund) throw new Error('Đã lưu phiếu trả nhưng không đọc lại được')

  console.log(
    `[refund] ${refund.refund_code} — hoàn ${refund.total.toLocaleString('vi-VN')} ₫ ` +
      `cho ${refund.invoice_code} (${refund.kind}) bởi ${staff.username}`
  )
  return refund
}
