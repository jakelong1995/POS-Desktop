import { useCallback, useEffect, useState } from 'react'
import type { Category, ProductWithCategory } from '@shared/types'
import { validateCategory } from '@shared/validation'
import type { CategoryInput, FieldErrors } from '@shared/validation'
import ConfirmDialog from '../components/ConfirmDialog'
import FormField from '../components/FormField'
import Modal from '../components/Modal'
import { useToast } from '../hooks/useToast'
import '../styles/page.css'
import './Products.css'

const EMPTY: CategoryInput = { name: '', description: '' }

/**
 * Màn hình quản lý danh mục (chỉ quản trị viên).
 *
 * Cột "Số sản phẩm" được đếm tại giao diện từ danh sách sản phẩm đã tải, vừa đủ
 * dùng cho quy mô cửa hàng nhỏ mà không cần thêm một truy vấn riêng.
 * Danh mục còn sản phẩm sẽ bị main process từ chối xóa.
 */
function Categories(): React.JSX.Element {
  const toast = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [input, setInput] = useState<CategoryInput>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors<CategoryInput>>({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    const [catRes, prodRes] = await Promise.all([
      window.api.category.list(),
      window.api.product.listAll()
    ])

    if (!catRes.success) {
      toast.error(catRes.error)
      setLoading(false)
      return
    }
    setCategories(catRes.data)
    if (prodRes.success) setProducts(prodRes.data)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  function countProducts(categoryId: number): number {
    return products.filter((p) => p.category_id === categoryId && p.is_active).length
  }

  function openCreate(): void {
    setEditing(null)
    setInput(EMPTY)
    setErrors({})
    setServerError('')
    setFormOpen(true)
  }

  function openEdit(category: Category): void {
    setEditing(category)
    setInput({ name: category.name, description: category.description ?? '' })
    setErrors({})
    setServerError('')
    setFormOpen(true)
  }

  async function handleSave(event: React.FormEvent): Promise<void> {
    event.preventDefault()

    const found = validateCategory(input)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    setServerError('')

    const res = editing
      ? await window.api.category.update(editing.id, input)
      : await window.api.category.create(input)

    setSaving(false)

    if (!res.success) {
      setServerError(res.error)
      return
    }

    toast.success(editing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục mới')
    setFormOpen(false)
    void reload()
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return

    const res = await window.api.category.remove(deleteTarget.id)
    const name = deleteTarget.name
    setDeleteTarget(null)

    if (!res.success) {
      toast.error(res.error)
      return
    }
    toast.success(`Đã xóa danh mục "${name}"`)
    void reload()
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">Quản lý danh mục</h1>
          <p className="page__subtitle">{categories.length} danh mục</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Thêm danh mục
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Tên danh mục</th>
                <th>Mô tả</th>
                <th className="num">Số sản phẩm</th>
                <th style={{ width: 180 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Đang tải…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Chưa có danh mục nào
                  </td>
                </tr>
              ) : (
                categories.map((c, index) => {
                  const count = countProducts(c.id)
                  return (
                    <tr key={c.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td style={{ whiteSpace: 'normal', maxWidth: 420 }}>
                        {c.description ?? '—'}
                      </td>
                      <td className="num">
                        <span className={`badge ${count > 0 ? 'badge--ok' : 'badge--low'}`}>
                          {count}
                        </span>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => openEdit(c)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm btn--danger-text"
                            onClick={() => setDeleteTarget(c)}
                            disabled={count > 0}
                            title={
                              count > 0
                                ? 'Không xóa được vì danh mục còn sản phẩm'
                                : 'Xóa danh mục'
                            }
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={formOpen}
        title={editing ? `Sửa danh mục: ${editing.name}` : 'Thêm danh mục mới'}
        width={520}
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
            <button
              type="submit"
              form="category-form"
              className="btn btn--primary"
              disabled={saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={(e) => void handleSave(e)} noValidate>
          {serverError && <div className="form-alert">{serverError}</div>}

          <FormField label="Tên danh mục" htmlFor="c-name" required error={errors.name}>
            <input
              id="c-name"
              className={`input ${errors.name ? 'input--error' : ''}`}
              value={input.name}
              placeholder="Ví dụ: Đồ đông lạnh"
              autoFocus
              onChange={(e) => setInput({ ...input, name: e.target.value })}
            />
          </FormField>

          <FormField
            label="Mô tả"
            htmlFor="c-desc"
            error={errors.description}
            hint="Không bắt buộc — dùng để ghi chú loại hàng thuộc danh mục này"
          >
            <textarea
              id="c-desc"
              className={`input ${errors.description ? 'input--error' : ''}`}
              value={input.description}
              rows={3}
              onChange={(e) => setInput({ ...input, description: e.target.value })}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xóa danh mục?"
        message={
          deleteTarget
            ? `Danh mục "${deleteTarget.name}" sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xóa danh mục"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default Categories
