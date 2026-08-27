import { useEffect, useState } from 'react'
import { LOW_STOCK_THRESHOLD } from '@shared/constants'
import type { Category, ProductWithCategory } from '@shared/types'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, formatNumber } from '../utils/format'
import '../styles/page.css'

/**
 * Trang tạm của Giai đoạn 2-3: đọc thẳng dữ liệu đã seed từ SQLite qua IPC
 * để chứng minh lớp cơ sở dữ liệu chạy đúng.
 * Giai đoạn 4 sẽ thay trang này bằng màn hình bán hàng thật
 * (lưới sản phẩm bên trái, giỏ hàng bên phải).
 */
function Sales(): React.JSX.Element {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      const [catRes, prodRes] = await Promise.all([
        window.api.category.list(),
        window.api.product.list()
      ])

      if (!catRes.success) return setError(catRes.error)
      if (!prodRes.success) return setError(prodRes.error)

      setCategories(catRes.data)
      setProducts(prodRes.data)
      setLoading(false)
    }
    void load()
  }, [])

  const lowStockCount = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length
  const inventoryValue = products.reduce((sum, p) => sum + p.cost * p.stock, 0)

  if (error) {
    return (
      <div className="placeholder">
        <div>
          <h2>Không đọc được dữ liệu</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="placeholder">
        <p>Đang tải dữ liệu…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Xin chào, {user?.full_name}</h1>
          <p className="page__subtitle">
            Dữ liệu dưới đây được đọc từ SQLite qua kênh IPC — màn hình bán hàng
            đầy đủ sẽ thay thế trang này ở Giai đoạn 4.
          </p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat__label">Danh mục</div>
          <div className="stat__value">{categories.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Sản phẩm đang bán</div>
          <div className="stat__value">{products.length}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Sắp hết hàng</div>
          <div className={`stat__value ${lowStockCount > 0 ? 'stat__value--warning' : ''}`}>
            {lowStockCount}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Giá trị tồn kho</div>
          <div className="stat__value">{formatCurrency(inventoryValue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">Danh sách sản phẩm mẫu</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Mã vạch</th>
                <th>Tên sản phẩm</th>
                <th>Danh mục</th>
                <th className="num">Giá bán</th>
                <th className="num">Tồn kho</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.barcode ?? '—'}</td>
                  <td>{p.name}</td>
                  <td>{p.category_name ?? '—'}</td>
                  <td className="num">{formatCurrency(p.price)}</td>
                  <td className="num">
                    {formatNumber(p.stock)} {p.unit}
                  </td>
                  <td>
                    {p.stock <= LOW_STOCK_THRESHOLD ? (
                      <span className="badge badge--low">Sắp hết</span>
                    ) : (
                      <span className="badge badge--ok">Còn hàng</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Sales
