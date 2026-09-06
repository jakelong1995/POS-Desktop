import { getDb } from '../connection'
import type {
  DateRange,
  ReportSummary,
  RevenuePoint,
  TopProduct
} from '../../../shared/reportTypes'

/** Chuyển khoảng ngày thành cặp mốc thời gian đầy đủ để so sánh chuỗi. */
function bounds(range: DateRange): [string, string] {
  return [`${range.from} 00:00:00`, `${range.to} 23:59:59`]
}

/**
 * Doanh thu theo từng ngày — dữ liệu cho biểu đồ đường.
 *
 * substr(created_at, 1, 10) cắt lấy phần "YYYY-MM-DD" từ chuỗi thời gian.
 * Việc gộp nhóm và cộng dồn để SQLite làm bằng GROUP BY thay vì tải hết hóa đơn
 * lên JavaScript rồi tự cộng: nhanh hơn nhiều và mã nguồn cũng ngắn hơn hẳn.
 *
 * Lưu ý: chỉ những ngày CÓ bán hàng mới xuất hiện. Phần điền các ngày trống
 * bằng 0 được làm ở giao diện để đường biểu đồ không bị đứt quãng.
 */
export function revenueByDay(range: DateRange): RevenuePoint[] {
  const [from, to] = bounds(range)

  // Hai nguồn số liệu được gộp bằng UNION ALL rồi mới GROUP BY, thay vì JOIN.
  // Lý do: một ngày có thể có bán mà không có trả, hoặc có trả mà không bán
  // (khách trả hàng mua từ tuần trước). JOIN kiểu nào cũng làm mất một trong
  // hai trường hợp đó; gộp rồi nhóm thì ngày nào có bất kỳ hoạt động nào cũng
  // xuất hiện đúng một dòng.
  //
  // Tiền hoàn được tính theo NGÀY LẬP PHIẾU TRẢ, không phải ngày bán. Đây là
  // cách ghi nhận của kế toán tiền mặt: ngày nào tiền rời két thì trừ ngày đó,
  // nhờ vậy tổng doanh thu thuần của kỳ luôn khớp với số tiền thật trong két.
  return getDb()
    .prepare<[string, string, string, string], RevenuePoint>(
      `SELECT day,
              SUM(revenue)       AS revenue,
              SUM(refund)        AS refund,
              SUM(invoice_count) AS invoice_count
       FROM (
         SELECT substr(created_at, 1, 10) AS day,
                total                     AS revenue,
                0                         AS refund,
                1                         AS invoice_count
         FROM invoices
         WHERE created_at BETWEEN ? AND ?
         UNION ALL
         SELECT substr(created_at, 1, 10) AS day,
                0                         AS revenue,
                total                     AS refund,
                0                         AS invoice_count
         FROM refunds
         WHERE created_at BETWEEN ? AND ?
       )
       GROUP BY day
       ORDER BY day`
    )
    .all(from, to, from, to)
}

/**
 * Sản phẩm bán chạy nhất — dữ liệu cho biểu đồ cột.
 *
 * Gộp theo product_name (tên đã chép lại lúc bán) chứ không theo product_id, để
 * sản phẩm đã bị ngừng kinh doanh vẫn hiện đúng trong báo cáo của kỳ trước.
 */
export function topProducts(range: DateRange, limit = 10): TopProduct[] {
  const [from, to] = bounds(range)
  return getDb()
    .prepare<[string, string, number], TopProduct>(
      `SELECT it.product_name           AS product_name,
              SUM(it.quantity)          AS quantity,
              SUM(it.line_total)        AS revenue
       FROM invoice_items it
       JOIN invoices i ON i.id = it.invoice_id
       WHERE i.created_at BETWEEN ? AND ?
       GROUP BY it.product_name
       ORDER BY quantity DESC, revenue DESC
       LIMIT ?`
    )
    .all(from, to, limit)
}

/**
 * Các chỉ số tổng quan của kỳ báo cáo.
 *
 * Về cột lợi nhuận gộp: giá vốn được lấy từ bảng products tại thời điểm XEM báo
 * cáo, không phải giá vốn lúc bán (bảng invoice_items không lưu giá vốn). Nếu
 * giá nhập hàng thay đổi thì con số này chỉ mang tính ước lượng. Muốn chính xác
 * tuyệt đối thì phải thêm cột unit_cost vào invoice_items — nằm ngoài phạm vi
 * đồ án nên ở đây chấp nhận cách tính xấp xỉ.
 */
export function summary(range: DateRange): ReportSummary {
  const db = getDb()
  const [from, to] = bounds(range)

  const totals = db
    .prepare<[string, string], { revenue: number | null; invoice_count: number }>(
      `SELECT SUM(total) AS revenue, COUNT(*) AS invoice_count
       FROM invoices WHERE created_at BETWEEN ? AND ?`
    )
    .get(from, to)

  const items = db
    .prepare<[string, string], { item_count: number | null }>(
      `SELECT SUM(it.quantity) AS item_count
       FROM invoice_items it
       JOIN invoices i ON i.id = it.invoice_id
       WHERE i.created_at BETWEEN ? AND ?`
    )
    .get(from, to)

  const profit = db
    .prepare<[string, string], { gross_profit: number | null }>(
      `SELECT SUM((it.unit_price - COALESCE(p.cost, 0)) * it.quantity) AS gross_profit
       FROM invoice_items it
       JOIN invoices i ON i.id = it.invoice_id
       LEFT JOIN products p ON p.id = it.product_id
       WHERE i.created_at BETWEEN ? AND ?`
    )
    .get(from, to)

  // Hàng trả lại cũng phải trừ khỏi lợi nhuận gộp, nếu không thì trả hàng lại
  // làm báo cáo đẹp lên: doanh thu thuần giảm mà lợi nhuận vẫn giữ nguyên.
  const refunds = db
    .prepare<[string, string], { refund_total: number | null; refund_count: number }>(
      `SELECT SUM(total) AS refund_total, COUNT(*) AS refund_count
       FROM refunds WHERE created_at BETWEEN ? AND ?`
    )
    .get(from, to)

  const refundProfit = db
    .prepare<[string, string], { lost_profit: number | null }>(
      `SELECT SUM((ri.unit_price - COALESCE(p.cost, 0)) * ri.quantity) AS lost_profit
       FROM refund_items ri
       JOIN refunds r ON r.id = ri.refund_id
       LEFT JOIN products p ON p.id = ri.product_id
       WHERE r.created_at BETWEEN ? AND ?`
    )
    .get(from, to)

  const revenue = totals?.revenue ?? 0
  const invoiceCount = totals?.invoice_count ?? 0
  const refundTotal = refunds?.refund_total ?? 0
  const grossProfit = (profit?.gross_profit ?? 0) - (refundProfit?.lost_profit ?? 0)

  return {
    revenue,
    refund_total: refundTotal,
    net_revenue: revenue - refundTotal,
    refund_count: refunds?.refund_count ?? 0,
    invoice_count: invoiceCount,
    item_count: items?.item_count ?? 0,
    average_invoice: invoiceCount > 0 ? Math.round(revenue / invoiceCount) : 0,
    gross_profit: grossProfit
  }
}
