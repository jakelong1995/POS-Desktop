import { BrowserWindow } from 'electron'
import { CHANNELS } from '../../shared/channels'
import type { RefundPayload, RefundWithItems, RefundableInvoice } from '../../shared/types'
import type { RefundListFilter, RefundListResult } from '../../shared/reportTypes'
import * as refundRepo from '../db/repositories/refundRepository'
import { createRefund, prepareRefund } from '../services/refund'
import { previewRefund, printRefund } from '../services/printer'
import { requireAuth } from '../services/session'
import { registerHandler } from './registerHandler'

/** Lấy dữ liệu dựng form trả hàng cho một hóa đơn. */
function handlePrepare(invoiceId: number): RefundableInvoice {
  requireAuth()
  return prepareRefund(invoiceId)
}

/**
 * Lập phiếu trả.
 * Người lập lấy từ phiên đăng nhập trong main process — vừa để ghi đúng ai đã
 * duyệt hoàn tiền, vừa để service biết có được vượt hạn đổi trả hay không.
 */
function handleCreate(payload: RefundPayload): RefundWithItems {
  const staff = requireAuth()
  return createRefund(payload, staff)
}

function handleDetail(refundId: number): RefundWithItems {
  requireAuth()
  const refund = refundRepo.findWithItems(refundId)
  if (!refund) throw new Error('Không tìm thấy phiếu trả')
  return refund
}

function handleList(filter: RefundListFilter): RefundListResult {
  requireAuth()
  return refundRepo.list(filter ?? {})
}

function loadRefundOrThrow(refundId: number): RefundWithItems {
  const refund = refundRepo.findWithItems(refundId)
  if (!refund) throw new Error('Không tìm thấy phiếu trả cần in')
  return refund
}

async function handlePreviewSlip(refundId: number): Promise<boolean> {
  requireAuth()
  return previewRefund(loadRefundOrThrow(refundId), BrowserWindow.getFocusedWindow())
}

async function handlePrintSlip(refundId: number): Promise<boolean> {
  requireAuth()
  return printRefund(loadRefundOrThrow(refundId), BrowserWindow.getFocusedWindow())
}

export function registerRefundHandlers(): void {
  registerHandler(CHANNELS.REFUND_PREPARE, handlePrepare)
  registerHandler(CHANNELS.REFUND_CREATE, handleCreate)
  registerHandler(CHANNELS.REFUND_DETAIL, handleDetail)
  registerHandler(CHANNELS.REFUND_LIST, handleList)
  registerHandler(CHANNELS.PRINT_REFUND_PREVIEW, handlePreviewSlip)
  registerHandler(CHANNELS.PRINT_REFUND, handlePrintSlip)
}
