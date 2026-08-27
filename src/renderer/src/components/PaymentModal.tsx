import { useEffect, useMemo, useRef, useState } from 'react'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@shared/constants'
import type { PaymentMethod } from '@shared/constants'
import type { InvoiceWithItems } from '@shared/types'
import { formatCurrency, formatDateTime } from '../utils/format'
import Modal from './Modal'

interface PaymentModalProps {
  open: boolean
  total: number
  submitting: boolean
  /** Hóa đơn vừa lập — có giá trị thì hộp thoại chuyển sang màn hình kết quả. */
  invoice: InvoiceWithItems | null
  onConfirm: (method: PaymentMethod, customerPaid: number) => void
  onClose: () => void
  onNewOrder: () => void
  onPreview: (invoiceId: number) => void
  onPrint: (invoiceId: number) => void
}

/**
 * Gợi ý các mệnh giá khách hay đưa.
 *
 * Cách tính: lấy đúng số tiền phải trả, rồi làm tròn lên tới các mốc 1.000 /
 * 5.000 / 10.000 / 50.000 / 100.000 / 500.000 đồng. Thu ngân bấm một phát là
 * xong, không phải gõ số — đây là chi tiết nhỏ nhưng tiết kiệm rất nhiều thao
 * tác trong thực tế.
 */
function suggestAmounts(total: number): number[] {
  if (total <= 0) return []
  const steps = [1000, 5000, 10000, 50000, 100000, 500000]
  const suggestions = new Set<number>([total])

  for (const step of steps) {
    const rounded = Math.ceil(total / step) * step
    if (rounded > total) suggestions.add(rounded)
  }

  return [...suggestions].sort((a, b) => a - b).slice(0, 5)
}

function PaymentModal({
  open,
  total,
  submitting,
  invoice,
  onConfirm,
  onClose,
  onNewOrder,
  onPreview,
  onPrint
}: PaymentModalProps): React.JSX.Element {
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS.CASH)
  const [paidText, setPaidText] = useState('')
  const paidInputRef = useRef<HTMLInputElement>(null)

  // Mỗi lần mở hộp thoại thì đặt lại về mặc định: tiền mặt, ô tiền khách đưa
  // để trống và con trỏ nhảy sẵn vào ô đó.
  useEffect(() => {
    if (!open) return
    setMethod(PAYMENT_METHODS.CASH)
    setPaidText('')
    window.setTimeout(() => paidInputRef.current?.focus(), 60)
  }, [open])

  const customerPaid = paidText ? Number.parseInt(paidText, 10) : 0
  const isCash = method === PAYMENT_METHODS.CASH
  const change = customerPaid - total
  const notEnough = isCash && customerPaid < total
  const suggestions = useMemo(() => suggestAmounts(total), [total])

  /* ---------- Màn hình kết quả sau khi lưu hóa đơn thành công ---------- */
  if (invoice) {
    return (
      <Modal
        open={open}
        title="Thanh toán thành công"
        width={460}
        onClose={onNewOrder}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onPreview(invoice.id)}
            >
              Xem trước
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onPrint(invoice.id)}
            >
              In hóa đơn
            </button>
            <button type="button" className="btn btn--primary" onClick={onNewOrder} autoFocus>
              Đơn mới
            </button>
          </>
        }
      >
        <div className="receipt-done">
          <div className="receipt-done__icon">✓</div>
          <div className="receipt-done__code">{invoice.invoice_code}</div>
          <div className="receipt-done__meta">
            {formatDateTime(invoice.created_at)} · {invoice.cashier_name}
            <br />
            {invoice.items.length} mặt hàng ·{' '}
            {PAYMENT_METHOD_LABELS[invoice.payment_method]}
          </div>

          <div className="receipt-done__change">
            Tiền thối lại
            <strong>{formatCurrency(invoice.change_amount)}</strong>
          </div>

          <div className="summary-row">
            <span className="summary-row__label">Tổng tiền</span>
            <span className="summary-row__value">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">Khách đưa</span>
            <span className="summary-row__value">{formatCurrency(invoice.customer_paid)}</span>
          </div>
        </div>
      </Modal>
    )
  }

  /* ---------- Màn hình nhập thanh toán ---------- */
  return (
    <Modal
      open={open}
      title="Thanh toán"
      width={520}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Quay lại
          </button>
          <button
            type="button"
            className="btn btn--success"
            onClick={() => onConfirm(method, isCash ? customerPaid : total)}
            disabled={submitting || notEnough}
          >
            {submitting ? 'Đang lưu…' : 'Xác nhận thanh toán'}
          </button>
        </>
      }
    >
      <div className="payment__total">
        <div className="payment__total-label">Số tiền khách phải trả</div>
        <div className="payment__total-value">{formatCurrency(total)}</div>
      </div>

      <div className="form-field__label">Phương thức thanh toán</div>
      <div className="payment__methods">
        {(Object.values(PAYMENT_METHODS) as PaymentMethod[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`method ${method === value ? 'method--active' : ''}`}
            onClick={() => setMethod(value)}
          >
            {PAYMENT_METHOD_LABELS[value]}
          </button>
        ))}
      </div>

      {isCash ? (
        <>
          <div className="form-field">
            <label className="form-field__label" htmlFor="customer-paid">
              Tiền khách đưa
            </label>
            <input
              id="customer-paid"
              ref={paidInputRef}
              className={`input payment__input-lg ${notEnough && paidText ? 'input--error' : ''}`}
              type="text"
              inputMode="numeric"
              value={paidText ? Number.parseInt(paidText, 10).toLocaleString('vi-VN') : ''}
              placeholder="0"
              onChange={(e) => setPaidText(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                // Nhấn Enter là xác nhận luôn, không cần rê chuột xuống nút
                if (e.key === 'Enter' && !notEnough && !submitting) {
                  onConfirm(method, customerPaid)
                }
              }}
            />
            <div className="payment__quick">
              {suggestions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setPaidText(String(amount))}
                >
                  {amount.toLocaleString('vi-VN')}
                </button>
              ))}
            </div>
          </div>

          <div className={`payment__change ${notEnough ? 'payment__change--short' : ''}`}>
            <span>{notEnough ? 'Còn thiếu' : 'Tiền thối lại'}</span>
            <span>{formatCurrency(Math.abs(change))}</span>
          </div>
        </>
      ) : (
        <p className="form-field__hint">
          Khách thanh toán bằng {PAYMENT_METHOD_LABELS[method].toLowerCase()} đúng số tiền
          {' '}
          {formatCurrency(total)}, không phát sinh tiền thối.
        </p>
      )}
    </Modal>
  )
}

export default PaymentModal
