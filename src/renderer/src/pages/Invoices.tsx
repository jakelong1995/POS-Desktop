import { useCallback, useEffect, useState } from 'react'
import { PAYMENT_METHOD_LABELS } from '@shared/constants'
import type { InvoiceListResult, InvoiceListRow } from '@shared/reportTypes'
import type { InvoiceWithItems } from '@shared/types'
import DateRangeFilter from '../components/DateRangeFilter'
import type { Range } from '../components/DateRangeFilter'
import Modal from '../components/Modal'
import { useToast } from '../hooks/useToast'
import { daysAgo, today } from '../utils/date'
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format'
import '../styles/page.css'
import './Products.css'

const PAGE_SIZE = 20

/**
 * Màn hình lịch sử hóa đơn.
 *
 * Phân trang được làm ở phía database (LIMIT / OFFSET) chứ không tải hết rồi
 * cắt ở giao diện: sau vài tháng bán hàng, bảng invoices có thể lên tới hàng
 * chục nghìn dòng, tải hết một lần sẽ làm ứng dụng đứng vài giây.
 */
function Invoices(): React.JSX.Element {
  const toast = useToast()
  const [range, setRange] = useState<Range>({ from: daysAgo(29), to: today() })
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<InvoiceListResult>({
    rows: [],
    total: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)

  const [detail, setDetail] = useState<InvoiceWithItems | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = await window.api.invoice.list({
      from: range.from || null,
      to: range.to || null,
      keyword: keyword.trim() || null,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE
    })
    setLoading(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    setResult(res.data)
  }, [range, keyword, page, toast])

  // Khử dội 250ms cho ô tìm mã hóa đơn, giống màn hình bán hàng
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250)
    return () => window.clearTimeout(timer)
  }, [load])

  // Đổi bộ lọc thì phải quay về trang đầu, nếu không sẽ thấy trang trống
  useEffect(() => {
    setPage(0)
  }, [range, keyword])

  async function openDetail(row: InvoiceListRow): Promise<void> {
    setDetailLoading(true)
    const res = await window.api.invoice.detail(row.id)
    setDetailLoading(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    setDetail(res.data)
  }

  async function handlePreview(invoiceId: number): Promise<void> {
    const res = await window.api.print.preview(invoiceId)
    if (!res.success) toast.error(res.error)
  }

  async function handlePrint(invoiceId: number): Promise<void> {
    const res = await window.api.print.invoice(invoiceId)
    if (!res.success) toast.error(res.error)
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Lịch sử hóa đơn</h1>
          <p className="page__subtitle">
            {formatNumber(result.total)} hóa đơn · Tổng doanh thu{' '}
            {formatCurrency(result.totalRevenue)}
          </p>
        </div>
      </div>

      <DateRangeFilter range={range} onChange={setRange} allowAll />

      <div className="toolbar">
        <input
          className="input toolbar__search"
          type="text"
          value={keyword}
          placeholder="Tìm theo mã hóa đơn, ví dụ HD20260827…"
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="Tìm hóa đơn"
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mã hóa đơn</th>
                <th>Thời gian</th>
                <th>Thu ngân</th>
                <th className="num">Số mặt hàng</th>
                <th>Thanh toán</th>
                <th className="num">Tổng tiền</th>
                <th style={{ width: 210 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Đang tải…
                  </td>
                </tr>
              ) : result.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Không có hóa đơn nào trong khoảng thời gian này
                  </td>
                </tr>
              ) : (
                result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.invoice_code}</strong>
                    </td>
                    <td>{formatDateTime(row.created_at.replace(' ', 'T'))}</td>
                    <td>{row.cashier_name}</td>
                    <td className="num">{row.item_count}</td>
                    <td>
                      <span className="method-badge">
                        {PAYMENT_METHOD_LABELS[row.payment_method]}
                      </span>
                    </td>
                    <td className="num">
                      <strong>{formatCurrency(row.total)}</strong>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => void openDetail(row)}
                          disabled={detailLoading}
                        >
                          Chi tiết
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => void handlePreview(row.id)}
                        >
                          Xem trước
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => void handlePrint(row.id)}
                        >
                          In lại
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {result.total > PAGE_SIZE && (
          <div className="pagination">
            <span>
              Trang {page + 1} / {totalPages}
            </span>
            <div className="pagination__buttons">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Trước
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={detail !== null}
        title={detail ? `Hóa đơn ${detail.invoice_code}` : ''}
        width={620}
        onClose={() => setDetail(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDetail(null)}>
              Đóng
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => detail && void handlePreview(detail.id)}
            >
              Xem trước bản in
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => detail && void handlePrint(detail.id)}
            >
              In hóa đơn
            </button>
          </>
        }
      >
        {detail && (
          <>
            <div className="detail-meta">
              <div className="detail-meta__item">
                <span>Thời gian</span>
                <strong>{formatDateTime(detail.created_at.replace(' ', 'T'))}</strong>
              </div>
              <div className="detail-meta__item">
                <span>Thu ngân</span>
                <strong>{detail.cashier_name}</strong>
              </div>
              <div className="detail-meta__item">
                <span>Phương thức</span>
                <strong>{PAYMENT_METHOD_LABELS[detail.payment_method]}</strong>
              </div>
              <div className="detail-meta__item">
                <span>Số mặt hàng</span>
                <strong>{detail.items.length}</strong>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="num">SL</th>
                    <th className="num">Đơn giá</th>
                    <th className="num">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'normal' }}>{item.product_name}</td>
                      <td className="num">{item.quantity}</td>
                      <td className="num">{formatCurrency(item.unit_price)}</td>
                      <td className="num">{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="detail-total">
              <div className="summary-row">
                <span className="summary-row__label">Tạm tính</span>
                <span className="summary-row__value">{formatCurrency(detail.subtotal)}</span>
              </div>
              {detail.discount > 0 && (
                <div className="summary-row">
                  <span className="summary-row__label">Giảm giá</span>
                  <span className="summary-row__value">−{formatCurrency(detail.discount)}</span>
                </div>
              )}
              <div className="summary-row summary-row--total">
                <span className="summary-row__label">Tổng cộng</span>
                <span className="summary-row__value">{formatCurrency(detail.total)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Khách đưa</span>
                <span className="summary-row__value">
                  {formatCurrency(detail.customer_paid)}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Tiền thối</span>
                <span className="summary-row__value">
                  {formatCurrency(detail.change_amount)}
                </span>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

export default Invoices
