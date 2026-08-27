import { CHANNELS } from '../../shared/channels'
import * as reportRepo from '../db/repositories/reportRepository'
import type {
  DateRange,
  ReportSummary,
  RevenuePoint,
  TopProduct
} from '../../shared/reportTypes'
import { requireAdmin } from '../services/session'
import { registerHandler } from './registerHandler'

/**
 * Các handler báo cáo — chỉ quản trị viên xem được.
 * Thu ngân không được thấy doanh thu và lợi nhuận của cửa hàng.
 */

/** Kiểm tra khoảng ngày người dùng gửi lên có hợp lệ không. */
function assertRange(range: DateRange): DateRange {
  const pattern = /^\d{4}-\d{2}-\d{2}$/
  if (!range?.from || !range?.to || !pattern.test(range.from) || !pattern.test(range.to)) {
    throw new Error('Khoảng thời gian không hợp lệ')
  }
  if (range.from > range.to) {
    throw new Error('Ngày bắt đầu phải trước ngày kết thúc')
  }
  return range
}

function revenueByDay(range: DateRange): RevenuePoint[] {
  requireAdmin()
  return reportRepo.revenueByDay(assertRange(range))
}

function topProducts(range: DateRange, limit?: number): TopProduct[] {
  requireAdmin()
  return reportRepo.topProducts(assertRange(range), limit ?? 10)
}

function summary(range: DateRange): ReportSummary {
  requireAdmin()
  return reportRepo.summary(assertRange(range))
}

export function registerReportHandlers(): void {
  registerHandler(CHANNELS.REPORT_REVENUE_BY_DAY, revenueByDay)
  registerHandler(CHANNELS.REPORT_TOP_PRODUCTS, topProducts)
  registerHandler(CHANNELS.REPORT_SUMMARY, summary)
}
