import { useCallback, useEffect, useMemo, useState } from 'react'
import { LOW_STOCK_THRESHOLD } from '@shared/constants'
import type { Category, ProductWithCategory } from '@shared/types'
import type { ProductInput } from '@shared/validation'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import ProductForm from '../components/ProductForm'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatNumber } from '../utils/format'
import '../styles/page.css'
import './Products.css'

type StockFilter = 'all' | 'low' | 'inactive'

/**
 * Màn hình quản lý sản phẩm (chỉ quản trị viên).
 *
 * Danh sách được lọc ngay tại giao diện thay vì gọi lại database mỗi lần gõ:
 * cửa hàng nhỏ chỉ có vài trăm mặt hàng nên tải hết một lần rồi lọc bằng
 * JavaScript sẽ nhanh hơn và mượt hơn nhiều so với truy vấn liên tục.
 */
function Products(): React.JSX.Element {
  const toast = useToast()
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductWithCategory | null>(null)
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProductWithCategory | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    const [prodRes, catRes] = await Promise.all([
      window.api.product.listAll(),
      window.api.category.list()
    ])

    if (!prodRes.success) {
      toast.error(prodRes.error)
      setLoading(false)
      return
    }
    if (!catRes.success) {
      toast.error(catRes.error)
      setLoading(false)
      return
    }

    setProducts(prodRes.data)
    setCategories(catRes.data)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  /* ---------------- Lọc danh sách ---------------- */
  const filtered = useMemo(() => {
    const search = keyword.trim().toLowerCase()

    return products.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false

      if (stockFilter === 'low' && (p.stock > LOW_STOCK_THRESHOLD || !p.is_active)) return false
      if (stockFilter === 'inactive' && p.is_active) return false
      if (stockFilter === 'all' && !p.is_active) return false

      if (!search) return true
      return (
        p.name.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search) ||
        (p.barcode ?? '').includes(search)
      )
    })
  }, [products, keyword, categoryId, stockFilter])

  const lowStockCount = products.filter(
    (p) => p.is_active && p.stock <= LOW_STOCK_THRESHOLD
  ).length
  const inactiveCount = products.filter((p) => !p.is_active).length

  /* ---------------- Thêm / sửa ---------------- */
  function openCreate(): void {
    if (categories.length === 0) {
      toast.error('Hãy tạo ít nhất một danh mục trước khi thêm sản phẩm')
      return
    }
    setEditing(null)
    setServerError('')
    setFormOpen(true)
  }

  function openEdit(product: ProductWithCategory): void {
    setEditing(product)
    setServerError('')
    setFormOpen(true)
  }

  async function handleSave(input: ProductInput): Promise<void> {
    setSaving(true)
    setServerError('')

    const res = editing
      ? await window.api.product.update(editing.id, input)
      : await window.api.product.create(input)

    setSaving(false)

    if (!res.success) {
      // Lỗi nghiệp vụ (trùng SKU, trùng mã vạch…) hiện ngay trong form
      setServerError(res.error)
      return
    }

    toast.success(editing ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới')
    setFormOpen(false)
    void reload()
  }

  /* ---------------- Xóa mềm / khôi phục ---------------- */
  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return

    const res = await window.api.product.remove(deleteTarget.id)
    setDeleteTarget(null)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`Đã ngừng kinh doanh "${deleteTarget.name}"`)
    void reload()
  }

  async function handleRestore(product: ProductWithCategory): Promise<void> {
    const res = await window.api.product.restore(product.id)
    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`Đã bán lại "${product.name}"`)
    void reload()
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Quản lý sản phẩm</h1>
          <p className="page__subtitle">
            {products.filter((p) => p.is_active).length} sản phẩm đang kinh doanh
            {inactiveCount > 0 && ` · ${inactiveCount} đã ngừng`}
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Thêm sản phẩm
        </button>
      </div>

      {lowStockCount > 0 && stockFilter !== 'low' && (
        <div className="alert-bar" onClick={() => setStockFilter('low')} role="button" tabIndex={0}>
          <Icon name="warning" size={18} />
          <span>
            Có <strong>{lowStockCount}</strong> sản phẩm còn dưới {LOW_STOCK_THRESHOLD} đơn vị —
            bấm để xem danh sách cần nhập thêm.
          </span>
        </div>
      )}

      <div className="toolbar">
        <input
          className="input toolbar__search"
          type="text"
          value={keyword}
          placeholder="Tìm theo tên, SKU hoặc mã vạch…"
          onChange={(e) => setKeyword(e.target.value)}
          aria-label="Tìm kiếm sản phẩm"
        />

        <select
          className="select toolbar__select"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
          aria-label="Lọc theo danh mục"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="select toolbar__select"
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Đang kinh doanh</option>
          <option value="low">Sắp hết hàng ({lowStockCount})</option>
          <option value="inactive">Đã ngừng ({inactiveCount})</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>SKU</th>
                <th>Danh mục</th>
                <th className="num">Giá bán</th>
                <th className="num">Giá vốn</th>
                <th className="num">Tồn kho</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Đang tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    Không có sản phẩm nào phù hợp
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className={p.is_active ? '' : 'row--inactive'}>
                    <td>
                      <div className="cell-product">
                        <div className="cell-product__thumb">
                          {p.image_path ? (
                            <img src={`pos-image://local/${p.image_path}`} alt="" />
                          ) : (
                            p.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="cell-product__name">{p.name}</div>
                          <div className="cell-product__barcode">{p.barcode ?? 'Không có mã vạch'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.sku}</td>
                    <td>{p.category_name ?? '—'}</td>
                    <td className="num">{formatCurrency(p.price)}</td>
                    <td className="num">{formatCurrency(p.cost)}</td>
                    <td className="num">
                      <span
                        className={`badge ${
                          p.stock <= LOW_STOCK_THRESHOLD ? 'badge--low' : 'badge--ok'
                        }`}
                      >
                        {formatNumber(p.stock)} {p.unit}
                      </span>
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => openEdit(p)}
                        >
                          Sửa
                        </button>
                        {p.is_active ? (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm btn--danger-text"
                            onClick={() => setDeleteTarget(p)}
                          >
                            Ngừng bán
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => void handleRestore(p)}
                          >
                            Bán lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={formOpen}
        title={editing ? `Sửa: ${editing.name}` : 'Thêm sản phẩm mới'}
        width={640}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Hủy
            </button>
            <button type="submit" form="product-form" className="btn btn--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <ProductForm
          formId="product-form"
          product={editing}
          categories={categories}
          serverError={serverError}
          onSubmit={(input) => void handleSave(input)}
        />
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Ngừng kinh doanh sản phẩm?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" sẽ không còn hiện ở màn hình bán hàng. Các hóa đơn cũ vẫn được giữ nguyên và anh có thể bật bán lại bất cứ lúc nào.`
            : ''
        }
        confirmLabel="Ngừng kinh doanh"
        cancelLabel="Giữ lại"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default Products
