import type { Invoice } from './types'

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
}

export interface InvoiceListResult {
  rows: InvoiceListRow[]
  total: number
  totalRevenue: number
}

export interface RevenuePoint {
  day: string
  revenue: number
  invoice_count: number
}

export interface TopProduct {
  product_name: string
  quantity: number
  revenue: number
}

export interface ReportSummary {
  revenue: number
  invoice_count: number
  item_count: number
  average_invoice: number
  /** Ước lượng: dùng giá vốn hiện tại của sản phẩm, không phải giá vốn lúc bán. */
  gross_profit: number
}
