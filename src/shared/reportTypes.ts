import type { Invoice, Refund } from './types'

/**
 * Kiểu dữ liệu của phần lịch sử hóa đơn và báo cáo.
 *
 * Tách riêng khỏi types.ts vì đây là hình dạng KẾT QUẢ TRUY VẤN (có cột tính
 * toán như item_count, revenue) chứ không phải cấu trúc bảng. Đặt ở shared/ để
 * repository trong main và giao diện dùng chung một định nghĩa.
 */

export interface DateRange {
  /** Ngày bắt đầu, dạng YYYY-MM-DD, tính cả ngày này. */
  from: string
  /** Ngày kết thúc, dạng YYYY-MM-DD, tính cả ngày này. */
  to: string
}

export interface InvoiceListFilter {
  from?: string | null
  to?: string | null
  keyword?: string | null
  limit?: number
  offset?: number
}

export interface InvoiceListRow extends Invoice {
  cashier_name: string
  item_count: number
  /** Tổng tiền đã hoàn của hóa đơn này, 0 nếu chưa trả lần nào. */
  refunded_total: number
}

export interface InvoiceListResult {
  rows: InvoiceListRow[]
  total: number
  /** Doanh thu gộp — tổng cột total của các hóa đơn khớp bộ lọc. */
  totalRevenue: number
  /** Tổng tiền đã hoàn cho chính các hóa đơn đó. */
  totalRefund: number
}

/* ------------------------------------------------------------------ */
/* Trả hàng                                                            */
/* ------------------------------------------------------------------ */

export interface RefundListFilter {
  from?: string | null
  to?: string | null
  keyword?: string | null
  limit?: number
  offset?: number
}

export interface RefundListRow extends Refund {
  invoice_code: string
  cashier_name: string
  item_count: number
}

export interface RefundListResult {
  rows: RefundListRow[]
  total: number
  totalRefund: number
}

export interface RevenuePoint {
  day: string
  /** Doanh thu gộp trong ngày, chưa trừ hàng trả. */
  revenue: number
  /** Tiền hoàn cho khách trong ngày — trừ theo NGÀY LẬP PHIẾU TRẢ. */
  refund: number
  invoice_count: number
}

export interface TopProduct {
  product_name: string
  quantity: number
  revenue: number
}

export interface ReportSummary {
  /** Doanh thu gộp — tổng tiền các hóa đơn lập trong kỳ. */
  revenue: number
  /** Tiền đã hoàn cho khách trong kỳ. */
  refund_total: number
  /** Doanh thu thuần = revenue − refund_total. Đây mới là tiền thật thu về. */
  net_revenue: number
  refund_count: number
  invoice_count: number
  item_count: number
  /** Trung bình mỗi hóa đơn, tính trên doanh thu gộp. */
  average_invoice: number
  /** Ước lượng: dùng giá vốn hiện tại của sản phẩm, không phải giá vốn lúc bán. */
  gross_profit: number
}
