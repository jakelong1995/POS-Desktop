import { getDb } from '../db/connection'
import * as invoiceRepo from '../db/repositories/invoiceRepository'
import * as productRepo from '../db/repositories/productRepository'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../shared/constants'
import type { CheckoutPayload, InvoiceWithItems, PublicUser } from '../../shared/types'

/**
 * ============================================================================
 * NGHIỆP VỤ THANH TOÁN — phần lõi của phần mềm bán hàng
 * ============================================================================
 *
 * Toàn bộ hàm này chạy trong MỘT transaction duy nhất. Nghĩa là 4 việc dưới đây
 * hoặc thành công cả 4, hoặc không việc nào xảy ra:
 *      1. Sinh mã hóa đơn
 *      2. Ghi bản ghi hóa đơn
 *      3. Ghi từng dòng chi tiết
 *      4. Trừ tồn kho từng sản phẩm
 *
 * Vì sao bắt buộc phải vậy? Giả sử mất điện ngay sau bước 3: nếu không có
 * transaction thì cửa hàng có một hóa đơn đã lập nhưng tồn kho chưa trừ — sổ
 * sách và hàng thực tế lệch nhau, càng bán càng sai. Với transaction, SQLite
 * sẽ quay lui (rollback) toàn bộ, coi như lần thanh toán đó chưa từng xảy ra.
 *
 * Nguyên tắc bảo mật: MỌI con số tiền đều được tính lại từ giá trong database.
 * Renderer chỉ được phép gửi lên mã sản phẩm và số lượng.
 */
export function checkout(payload: CheckoutPayload, cashier: PublicUser): InvoiceWithItems {
  const db = getDb()

  // ---- Kiểm tra dữ liệu đầu vào trước khi mở transaction ----
  if (!payload?.items?.length) {
    throw new Error('Giỏ hàng đang trống, không thể thanh toán')
  }

  const validMethods = Object.values(PAYMENT_METHODS) as string[]
  if (!validMethods.includes(payload.payment_method)) {
    throw new Error('Phương thức thanh toán không hợp lệ')
  }

  for (const item of payload.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Số lượng sản phẩm phải là số nguyên lớn hơn 0')
    }
  }

  // db.transaction() trả về một hàm; mọi câu lệnh chạy bên trong hàm đó nằm
  // trong cùng một transaction. better-sqlite3 chạy đồng bộ nên không có nguy cơ
  // một tác vụ async khác chen ngang vào giữa.
  const runCheckout = db.transaction((): number => {
    let subtotal = 0

    // Bước 1: đọc lại từng sản phẩm từ DB và kiểm tra tồn kho.
    // Làm trọn vòng lặp này trước khi ghi bất cứ thứ gì, để nếu có sản phẩm
    // thiếu hàng thì báo lỗi ngay mà chưa động vào dữ liệu.
    const lines = payload.items.map((item) => {
      const product = productRepo.findById(item.product_id)

      if (!product) {
        throw new Error(`Không tìm thấy sản phẩm có mã ${item.product_id}`)
      }
      if (!product.is_active) {
        throw new Error(`Sản phẩm "${product.name}" đã ngừng kinh doanh`)
      }
      if (product.stock < item.quantity) {
        throw new Error(
          `Sản phẩm "${product.name}" chỉ còn ${product.stock} ${product.unit}, ` +
            `không đủ ${item.quantity} ${product.unit}`
        )
      }

      const lineTotal = product.price * item.quantity
      subtotal += lineTotal
      return { product, quantity: item.quantity, unitPrice: product.price }
    })

    // Bước 2: tính tiền. Giảm giá không được âm và không được vượt tạm tính.
    const discount = Math.round(payload.discount ?? 0)
    if (discount < 0) throw new Error('Số tiền giảm giá không được âm')
    if (discount > subtotal) throw new Error('Số tiền giảm giá không được lớn hơn tạm tính')

    const total = subtotal - discount

    // Bước 3: kiểm tra tiền khách đưa.
    // Chỉ tiền mặt mới phải trả lại tiền thừa; chuyển khoản và quẹt thẻ thì
    // số tiền luôn khớp đúng nên tiền thối bằng 0.
    let customerPaid = Math.round(payload.customer_paid ?? 0)
    let changeAmount = 0

    if (payload.payment_method === PAYMENT_METHODS.CASH) {
      if (customerPaid < total) {
        throw new Error(
          `Khách đưa chưa đủ tiền — còn thiếu ${(total - customerPaid).toLocaleString('vi-VN')} ₫`
        )
      }
      changeAmount = customerPaid - total
    } else {
      customerPaid = total
    }

    // Bước 4: ghi hóa đơn, ghi chi tiết, trừ kho.
    const invoiceCode = invoiceRepo.nextInvoiceCode()
    const invoiceId = invoiceRepo.insertInvoice({
      invoice_code: invoiceCode,
      user_id: cashier.id,
      subtotal,
      discount,
      total,
      payment_method: payload.payment_method,
      customer_paid: customerPaid,
      change_amount: changeAmount
    })

    for (const line of lines) {
      invoiceRepo.insertInvoiceItem(
        invoiceId,
        line.product.id,
        line.product.name,
        line.quantity,
        line.unitPrice
      )
      invoiceRepo.decreaseStock(line.product.id, line.quantity)
    }

    return invoiceId
  })

  const invoiceId = runCheckout()

  const invoice = invoiceRepo.findWithItems(invoiceId)
  if (!invoice) throw new Error('Đã lưu hóa đơn nhưng không đọc lại được')

  console.log(
    `[checkout] ${invoice.invoice_code} — ${invoice.total.toLocaleString('vi-VN')} ₫ ` +
      `(${PAYMENT_METHOD_LABELS[invoice.payment_method]}) bởi ${cashier.username}`
  )
  return invoice
}
