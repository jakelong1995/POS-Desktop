import { BrowserWindow } from 'electron'
import { CHANNELS } from '../../shared/channels'
import type { CheckoutPayload, InvoiceWithItems } from '../../shared/types'
import * as invoiceRepo from '../db/repositories/invoiceRepository'
import type { InvoiceListFilter, InvoiceListResult } from '../../shared/reportTypes'
import { checkout } from '../services/checkout'
import { previewInvoice, printInvoice } from '../services/printer'
import { requireAuth } from '../services/session'
import { registerHandler } from './registerHandler'

/**
 * Thanh toán giỏ hàng.
 * Người thực hiện được lấy từ phiên đăng nhập trong main process, KHÔNG lấy từ
 * dữ liệu renderer gửi lên — nếu không, ai cũng có thể ghi hóa đơn dưới tên
 * người khác.
 */
function handleCheckout(payload: CheckoutPayload): InvoiceWithItems {
  const cashier = requireAuth()
  return checkout(payload, cashier)
}

function handleDetail(invoiceId: number): InvoiceWithItems {
  requireAuth()
  const invoice = invoiceRepo.findWithItems(invoiceId)
  if (!invoice) throw new Error('Không tìm thấy hóa đơn')
  return invoice
}

function handleList(filter: InvoiceListFilter): InvoiceListResult {
  requireAuth()
  return invoiceRepo.list(filter ?? {})
}

/** Lấy hóa đơn rồi ném lỗi tiếng Việt nếu không có — dùng chung cho in và xem trước. */
function loadInvoiceOrThrow(invoiceId: number): InvoiceWithItems {
  const invoice = invoiceRepo.findWithItems(invoiceId)
  if (!invoice) throw new Error('Không tìm thấy hóa đơn cần in')
  return invoice
}

/** Mở cửa sổ xem trước bản in khổ 80mm. */
async function handlePreview(invoiceId: number): Promise<boolean> {
  requireAuth()
  const invoice = loadInvoiceOrThrow(invoiceId)
  return previewInvoice(invoice, BrowserWindow.getFocusedWindow())
}

/** In thẳng ra máy in (vẫn hiện hộp thoại chọn máy in của hệ điều hành). */
async function handlePrint(invoiceId: number): Promise<boolean> {
  requireAuth()
  const invoice = loadInvoiceOrThrow(invoiceId)
  return printInvoice(invoice, BrowserWindow.getFocusedWindow())
}

export function registerInvoiceHandlers(): void {
  registerHandler(CHANNELS.INVOICE_CHECKOUT, handleCheckout)
  registerHandler(CHANNELS.INVOICE_DETAIL, handleDetail)
  registerHandler(CHANNELS.INVOICE_LIST, handleList)
  registerHandler(CHANNELS.PRINT_PREVIEW, handlePreview)
  registerHandler(CHANNELS.PRINT_INVOICE, handlePrint)
}
