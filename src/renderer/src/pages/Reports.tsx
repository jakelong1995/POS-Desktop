import { useCallback, useEffect, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import type { ReportSummary, RevenuePoint, TopProduct } from '@shared/reportTypes'
import DateRangeFilter from '../components/DateRangeFilter'
import type { Range } from '../components/DateRangeFilter'
import { useToast } from '../hooks/useToast'
import { daysAgo, eachDay, shortDayLabel, today } from '../utils/date'
import { formatCurrency, formatNumber } from '../utils/format'
import '../styles/page.css'
import './Reports.css'

/**
 * Chart.js dùng kiến trúc "đăng ký từng phần": chỉ những thành phần được nạp ở
 * đây mới nằm trong bản build cuối. Nhờ vậy file .exe không phải mang theo mã
 * của những loại biểu đồ mà đồ án không dùng (bánh, radar, bong bóng…).
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
)

/** Rút gọn số tiền trên trục đứng: 1500000 -> "1,5tr", 45000 -> "45k" */
function compactMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}tr`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

function Reports(): React.JSX.Element {
  const toast = useToast()
  const [range, setRange] = useState<Range>({ from: daysAgo(29), to: today() })
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [top, setTop] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    if (!range.from || !range.to) return
    setLoading(true)

    const [sumRes, revRes, topRes] = await Promise.all([
      window.api.report.summary(range),
      window.api.report.revenueByDay(range),
      window.api.report.topProducts(range, 10)
    ])

    setLoading(false)

    if (!sumRes.success) return toast.error(sumRes.error)
    if (!revRes.success) return toast.error(revRes.error)
    if (!topRes.success) return toast.error(topRes.error)

    setSummary(sumRes.data)
    setRevenue(revRes.data)
    setTop(topRes.data)
  }, [range, toast])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Ghép dữ liệu truy vấn với danh sách đầy đủ các ngày trong khoảng.
   * Ngày nào không có hóa đơn thì doanh thu bằng 0 — nếu bỏ qua, đường biểu đồ
   * sẽ nối thẳng qua những ngày nghỉ và cho cảm giác sai là ngày nào cũng bán.
   */
  const days = eachDay(range.from, range.to)
  const revenueByDay = new Map(revenue.map((point) => [point.day, point.revenue]))
  const revenueSeries = days.map((day) => revenueByDay.get(day) ?? 0)

  const lineData = {
    labels: days.map(shortDayLabel),
    datasets: [
      {
        label: 'Doanh thu',
        data: revenueSeries,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        borderWidth: 2,
        pointRadius: days.length > 45 ? 0 : 3,
        pointBackgroundColor: '#2563eb',
        tension: 0.3,
        fill: true
      }
    ]
  }

  const lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` Doanh thu: ${formatCurrency(context.parsed.y ?? 0)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => compactMoney(Number(value)) },
        grid: { color: '#e2e8f0' }
      },
      x: { grid: { display: false } }
    }
  }

  const barData = {
    labels: top.map((p) => (p.product_name.length > 26 ? `${p.product_name.slice(0, 26)}…` : p.product_name)),
    datasets: [
      {
        label: 'Số lượng bán',
        data: top.map((p) => p.quantity),
        backgroundColor: '#16a34a',
        borderRadius: 6,
        maxBarThickness: 34
      }
    ]
  }

  const barOptions: ChartOptions<'bar'> = {
    // indexAxis 'y' biến biểu đồ cột dọc thành cột ngang — tên sản phẩm tiếng
    // Việt khá dài, để ngang mới đọc được mà không phải xoay nghiêng chữ.
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = top[context.dataIndex]
            return ` ${formatNumber(item.quantity)} sản phẩm · ${formatCurrency(item.revenue)}`
          }
        }
      }
    },
    scales: {
      x: { beginAtZero: true, grid: { color: '#e2e8f0' } },
      y: { grid: { display: false } }
    }
  }

  const hasData = summary !== null && summary.invoice_count > 0

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Báo cáo doanh thu</h1>
          <p className="page__subtitle">
            Từ {range.from.split('-').reverse().join('/')} đến{' '}
            {range.to.split('-').reverse().join('/')}
          </p>
        </div>
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

      <div className="stats">
        <div className="stat">
          <div className="stat__label">Doanh thu</div>
          <div className="stat__value stat__value--money">
            {formatCurrency(summary?.revenue ?? 0)}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Số hóa đơn</div>
          <div className="stat__value">{formatNumber(summary?.invoice_count ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Sản phẩm đã bán</div>
          <div className="stat__value">{formatNumber(summary?.item_count ?? 0)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Trung bình / hóa đơn</div>
          <div className="stat__value stat__value--money">
            {formatCurrency(summary?.average_invoice ?? 0)}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">
            Lợi nhuận gộp <span className="stat__note" title="Tính theo giá vốn hiện tại của sản phẩm">ước tính</span>
          </div>
          <div className="stat__value stat__value--money stat__value--success">
            {formatCurrency(summary?.gross_profit ?? 0)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p className="empty">Đang tính toán số liệu…</p>
        </div>
      ) : !hasData ? (
        <div className="card">
          <p className="empty">
            Chưa có hóa đơn nào trong khoảng thời gian này.
            <br />
            Hãy bán vài đơn ở màn hình Bán hàng rồi quay lại xem báo cáo.
          </p>
        </div>
      ) : (
        <div className="charts">
          <div className="card">
            <div className="card__title">Doanh thu theo ngày</div>
            <div className="chart-box">
              <Line data={lineData} options={lineOptions} />
            </div>
          </div>

          <div className="card">
            <div className="card__title">Top 10 sản phẩm bán chạy</div>
            <div className="chart-box chart-box--tall">
              <Bar data={barData} options={barOptions} />
            </div>
          </div>

          <div className="card">
            <div className="card__title">Chi tiết sản phẩm bán chạy</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Sản phẩm</th>
                    <th className="num">Số lượng</th>
                    <th className="num">Doanh thu</th>
                    <th className="num">Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((product, index) => {
                    const share = summary.revenue
                      ? (product.revenue / summary.revenue) * 100
                      : 0
                    return (
                      <tr key={product.product_name}>
                        <td>{index + 1}</td>
                        <td style={{ whiteSpace: 'normal' }}>{product.product_name}</td>
                        <td className="num">{formatNumber(product.quantity)}</td>
                        <td className="num">{formatCurrency(product.revenue)}</td>
                        <td className="num">{share.toFixed(1).replace('.', ',')}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
