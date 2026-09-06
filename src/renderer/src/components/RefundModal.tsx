import { useCallback, useEffect, useMemo, useState } from 'react'
import { REFUND_KIND_LABELS, REFUND_REASONS } from '@shared/constants'
import type { RefundWithItems, RefundableInvoice } from '@shared/types'
import FormField from './FormField'
import Modal from './Modal'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDateTime } from '../utils/format'
import './RefundModal.css'

interface RefundModalProps {
  /** Hóa đơn cần trả hàng; null nghĩa là đóng hộp thoại. */
  invoiceId: number | null
  onClose: () => void
  /** Gọi sau khi lập phiếu thành công để màn hình cha tải lại danh sách. */
  onDone: (refund: RefundWithItems) => void
}

/**
 * Hộp thoại trả hàng — dùng chung cho trả một phần và trả toàn bộ.
 *
 * Vì sao không tách thành hai nút "Trả một phần" / "Trả toàn bộ" riêng?
 * Vì trả toàn bộ chỉ là trả một phần với mọi dòng chọn hết số còn lại. Gộp
 * chung một form rồi thêm nút "Chọn tất cả" vừa ít mã nguồn hơn, vừa cho thu
 * ngân đổi ý giữa chừng mà không phải đóng mở lại hộp thoại.
 *
 * Mọi con số tiền hiện ở đây đều do main process tính sẵn và gửi lên
 * (effective_unit_price), giao diện chỉ nhân với số lượng. Nếu để giao diện tự
 * tính theo unit_price của hóa đơn thì màn hình sẽ hiện một số, mà phiếu in ra
 * lại là số khác — do phần giảm giá phân bổ chưa được trừ.
 */
function RefundModal({ invoiceId, onClose, onDone }: RefundModalProps): React.JSX.Element {
  const toast = useToast()
  const [data, setData] = useState<RefundableInvoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  /** Số lượng trả của từng dòng, khóa là invoice_item_id. */
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    if (invoiceId === null) return
    setLoading(true)
    const res = await window.api.refund.prepare(invoiceId)
    setLoading(false)

    if (!res.success) {
      toast.error(res.error)
      onClose()
      return
    }
    setData(res.data)
    setQuantities({})
    setReason('')
    setRestock(true)
  }, [invoiceId, onClose, toast])

  useEffect(() => {
    if (invoiceId === null) {
      setData(null)
      return
    }
    void load()
  }, [invoiceId, load])

  const lines = data?.lines ?? []

  /**
   * Tiền hoàn tạm tính để thu ngân xem trước.
   *
   * Có một trường hợp con số này KHÔNG bằng số cuối cùng: khi trả nốt toàn bộ
   * hóa đơn, main process chốt bằng phần tiền còn lại thay vì cộng từng dòng,
   * để triệt tiêu sai số làm tròn. Nên chỗ này cũng phải bắt chước đúng logic
   * đó, nếu không thu ngân sẽ thấy màn hình một số mà phiếu in ra một số khác.
   */
  const { estimate, selectedCount, clearsInvoice } = useMemo(() => {
    let sum = 0
    let count = 0
    let clearsAll = lines.length > 0

    for (const line of lines) {
      const qty = quantities[line.id] ?? 0
      sum += qty * line.effective_unit_price
      count += qty
      if (line.remaining_quantity > 0 && qty < line.remaining_quantity) clearsAll = false
    }

    const remainingMoney = data?.refundable_total ?? 0
    return {
      estimate: clearsAll && count > 0 ? remainingMoney : Math.min(sum, remainingMoney),
      selectedCount: count,
      clearsInvoice: clearsAll && count > 0
    }
  }, [lines, quantities, data])

  function setQuantity(lineId: number, value: number, max: number): void {
    const clamped = Math.max(0, Math.min(Math.round(value) || 0, max))
    setQuantities((prev) => ({ ...prev, [lineId]: clamped }))
  }

  /** Chọn hết số còn trả được của mọi dòng — đây chính là "trả toàn bộ". */
  function selectAll(): void {
    const next: Record<number, number> = {}
    for (const line of lines) next[line.id] = line.remaining_quantity
    setQuantities(next)
  }

  function clearAll(): void {
    setQuantities({})
  }

  async function submit(): Promise<void> {
    if (invoiceId === null || selectedCount === 0) return

    setSaving(true)
    const res = await window.api.refund.create({
      invoice_id: invoiceId,
      items: lines
        .filter((line) => (quantities[line.id] ?? 0) > 0)
        .map((line) => ({ invoice_item_id: line.id, quantity: quantities[line.id] })),
      reason: reason.trim() || null,
      restock
    })
    setSaving(false)

    if (!res.success) {
      toast.error(res.error)
      // Tải lại để đồng bộ với thực tế: lỗi hay gặp nhất là "đã trả hết ở phiếu
      // trước", nghĩa là dữ liệu trên màn hình đã cũ so với database.
      void load()
      return
    }

    toast.success(
      `Đã lập phiếu ${res.data.refund_code} — hoàn ${formatCurrency(res.data.total)}`
    )
    onDone(res.data)
    onClose()
  }

  const nothingLeft = data?.fully_refunded ?? false

  return (
    <Modal
      open={invoiceId !== null}
      title={data ? `Trả hàng — hóa đơn ${data.invoice.invoice_code}` : 'Trả hàng'}
      width={720}
      onClose={onClose}
      footer={
        <>
          <div className="refund-footer__total">
            <span>Hoàn lại khách</span>
            <strong>{formatCurrency(estimate)}</strong>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => void submit()}
            disabled={saving || selectedCount === 0 || nothingLeft}
          >
            {saving
              ? 'Đang lưu…'
              : clearsInvoice
                ? 'Xác nhận trả toàn bộ'
                : `Xác nhận trả ${selectedCount} sản phẩm`}
          </button>
        </>
      }
    >
      {loading || !data ? (
        <p className="empty">Đang tải hóa đơn…</p>
      ) : (
        <>
          <div className="detail-meta">
            <div className="detail-meta__item">
              <span>Ngày bán</span>
              <strong>{formatDateTime(data.invoice.created_at.replace(' ', 'T'))}</strong>
            </div>
            <div className="detail-meta__item">
              <span>Tổng hóa đơn</span>
              <strong>{formatCurrency(data.invoice.total)}</strong>
            </div>
            <div className="detail-meta__item">
              <span>Đã hoàn</span>
              <strong>{formatCurrency(data.refunded_total)}</strong>
            </div>
            <div className="detail-meta__item">
              <span>Còn hoàn được</span>
              <strong>{formatCurrency(data.refundable_total)}</strong>
            </div>
          </div>

          {nothingLeft ? (
            <p className="refund-note refund-note--warn">
              Hóa đơn này đã được trả hết, không còn sản phẩm nào để trả.
            </p>
          ) : (
            <div className="refund-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={selectAll}>
                Chọn tất cả (trả toàn bộ)
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={clearAll}>
                Bỏ chọn hết
              </button>
            </div>
          )}

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th className="num">Đã mua</th>
                  <th className="num">Đã trả</th>
                  <th className="num">Đơn giá hoàn</th>
                  <th className="num" style={{ width: 120 }}>
                    Số lượng trả
                  </th>
                  <th className="num">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const qty = quantities[line.id] ?? 0
                  const done = line.remaining_quantity <= 0
                  return (
                    <tr key={line.id} className={done ? 'row--inactive' : ''}>
                      <td style={{ whiteSpace: 'normal' }}>{line.product_name}</td>
                      <td className="num">{line.quantity}</td>
                      <td className="num">{line.refunded_quantity || '—'}</td>
                      <td className="num">{formatCurrency(line.effective_unit_price)}</td>
                      <td className="num">
                        {done ? (
                          <span className="badge">Đã trả hết</span>
                        ) : (
                          <input
                            className="input refund-qty"
                            type="number"
                            min={0}
                            max={line.remaining_quantity}
                            value={qty}
                            onChange={(e) =>
                              setQuantity(line.id, Number(e.target.value), line.remaining_quantity)
                            }
                            aria-label={`Số lượng trả của ${line.product_name}`}
                          />
                        )}
                      </td>
                      <td className="num">
                        {qty > 0 ? formatCurrency(qty * line.effective_unit_price) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.invoice.discount > 0 && (
            <p className="refund-note">
              Hóa đơn có giảm giá {formatCurrency(data.invoice.discount)}, nên đơn giá hoàn đã
              được trừ tương ứng — khách chỉ được hoàn đúng phần đã trả.
            </p>
          )}

          {!nothingLeft && (
            <div className="refund-form">
              <FormField label="Lý do trả hàng" htmlFor="refund-reason">
                <input
                  id="refund-reason"
                  className="input"
                  type="text"
                  value={reason}
                  placeholder="Ví dụ: hàng lỗi, khách đổi ý…"
                  onChange={(e) => setReason(e.target.value)}
                  list="refund-reason-options"
                />
                <datalist id="refund-reason-options">
                  {REFUND_REASONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </FormField>

              <label className="refund-check">
                <input
                  type="checkbox"
                  checked={restock}
                  onChange={(e) => setRestock(e.target.checked)}
                />
                <span>
                  Nhập lại kho
                  <em>Bỏ chọn nếu hàng đã hỏng, không bán lại được</em>
                </span>
              </label>
            </div>
          )}

          {data.refunds.length > 0 && (
            <div className="refund-history">
              <h3>Các phiếu trả trước đó</h3>
              {data.refunds.map((refund) => (
                <div key={refund.id} className="refund-history__row">
                  <span>{refund.refund_code}</span>
                  <span>{REFUND_KIND_LABELS[refund.kind]}</span>
                  <span>{formatDateTime(refund.created_at.replace(' ', 'T'))}</span>
                  <strong>−{formatCurrency(refund.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

export default RefundModal
