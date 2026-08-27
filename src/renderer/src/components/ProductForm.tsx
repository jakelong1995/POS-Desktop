import { useEffect, useState } from 'react'
import type { Category, ProductWithCategory } from '@shared/types'
import { validateProduct } from '@shared/validation'
import type { FieldErrors, ProductInput } from '@shared/validation'
import FormField from './FormField'
import './ProductForm.css'

interface ProductFormProps {
  product: ProductWithCategory | null
  categories: Category[]
  /** Gửi lỗi trả về từ main process (trùng SKU…) để hiện ở đầu form. */
  serverError: string
  onSubmit: (input: ProductInput) => void
  formId: string
}

/** Giá trị mặc định khi thêm sản phẩm mới. */
function emptyInput(categories: Category[]): ProductInput {
  return {
    sku: '',
    barcode: '',
    name: '',
    category_id: categories[0]?.id ?? null,
    price: 0,
    cost: 0,
    stock: 0,
    unit: 'cái',
    image_path: null,
    is_active: 1
  }
}

/** Chỉ giữ lại chữ số khi người dùng gõ vào ô tiền / số lượng. */
function digitsOnly(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

/**
 * Form thêm / sửa sản phẩm.
 *
 * Quy tắc kiểm tra lấy từ shared/validation.ts — đúng bộ quy tắc mà main
 * process dùng lại lần nữa trước khi ghi vào database. Nhờ dùng chung, không
 * bao giờ có chuyện giao diện báo hợp lệ mà lưu xuống lại bị từ chối vì lý do
 * hình thức.
 */
function ProductForm({
  product,
  categories,
  serverError,
  onSubmit,
  formId
}: ProductFormProps): React.JSX.Element {
  const [input, setInput] = useState<ProductInput>(() => emptyInput(categories))
  const [errors, setErrors] = useState<FieldErrors<ProductInput>>({})
  const [touched, setTouched] = useState(false)

  // Nạp lại dữ liệu mỗi khi mở form với sản phẩm khác
  useEffect(() => {
    if (product) {
      setInput({
        sku: product.sku,
        barcode: product.barcode ?? '',
        name: product.name,
        category_id: product.category_id,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        unit: product.unit,
        image_path: product.image_path,
        is_active: product.is_active
      })
    } else {
      setInput(emptyInput(categories))
    }
    setErrors({})
    setTouched(false)
  }, [product, categories])

  /** Cập nhật một trường; sau lần bấm Lưu đầu tiên thì kiểm tra lại ngay khi gõ. */
  function patch(changes: Partial<ProductInput>): void {
    const next = { ...input, ...changes }
    setInput(next)
    if (touched) setErrors(validateProduct(next))
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    setTouched(true)

    const found = validateProduct(input)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    onSubmit(input)
  }

  async function handlePickImage(): Promise<void> {
    const res = await window.api.product.pickImage()
    if (!res.success) {
      setErrors((prev) => ({ ...prev, image_path: res.error }))
      return
    }
    if (res.data) patch({ image_path: res.data })
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      {serverError && <div className="form-alert">{serverError}</div>}

      <div className="product-form__image">
        <div className="product-form__thumb">
          {input.image_path ? (
            <img src={`pos-image://local/${input.image_path}`} alt="Ảnh sản phẩm" />
          ) : (
            <span>{input.name.charAt(0).toUpperCase() || '?'}</span>
          )}
        </div>
        <div className="product-form__image-actions">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void handlePickImage()}
          >
            {input.image_path ? 'Đổi ảnh' : 'Chọn ảnh'}
          </button>
          {input.image_path && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => patch({ image_path: null })}
            >
              Gỡ ảnh
            </button>
          )}
          <span className="form-field__hint">JPG, PNG, WEBP hoặc GIF · tối đa 5MB</span>
        </div>
      </div>

      <FormField label="Tên sản phẩm" htmlFor="p-name" required error={errors.name}>
        <input
          id="p-name"
          className={`input ${errors.name ? 'input--error' : ''}`}
          value={input.name}
          placeholder="Ví dụ: Sữa tươi Vinamilk 1L"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </FormField>

      <div className="form-row">
        <FormField label="Mã SKU" htmlFor="p-sku" required error={errors.sku}>
          <input
            id="p-sku"
            className={`input ${errors.sku ? 'input--error' : ''}`}
            value={input.sku}
            placeholder="SUA007"
            onChange={(e) => patch({ sku: e.target.value.toUpperCase() })}
          />
        </FormField>

        <FormField
          label="Mã vạch"
          htmlFor="p-barcode"
          error={errors.barcode}
          hint="Bỏ trống nếu sản phẩm không có mã vạch"
        >
          <input
            id="p-barcode"
            className={`input ${errors.barcode ? 'input--error' : ''}`}
            value={input.barcode}
            inputMode="numeric"
            placeholder="8930003000075"
            onChange={(e) => patch({ barcode: e.target.value.replace(/\D/g, '') })}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Danh mục" htmlFor="p-category" required error={errors.category_id}>
          <select
            id="p-category"
            className={`select ${errors.category_id ? 'select--error' : ''}`}
            value={input.category_id ?? ''}
            onChange={(e) =>
              patch({ category_id: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">— Chọn danh mục —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Đơn vị tính" htmlFor="p-unit" required error={errors.unit}>
          <input
            id="p-unit"
            className={`input ${errors.unit ? 'input--error' : ''}`}
            value={input.unit}
            placeholder="hộp, chai, gói…"
            onChange={(e) => patch({ unit: e.target.value })}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Giá bán (₫)" htmlFor="p-price" required error={errors.price}>
          <input
            id="p-price"
            className={`input ${errors.price ? 'input--error' : ''}`}
            inputMode="numeric"
            value={input.price ? input.price.toLocaleString('vi-VN') : ''}
            placeholder="0"
            onChange={(e) => patch({ price: digitsOnly(e.target.value) })}
          />
        </FormField>

        <FormField label="Giá vốn (₫)" htmlFor="p-cost" error={errors.cost}>
          <input
            id="p-cost"
            className={`input ${errors.cost ? 'input--error' : ''}`}
            inputMode="numeric"
            value={input.cost ? input.cost.toLocaleString('vi-VN') : ''}
            placeholder="0"
            onChange={(e) => patch({ cost: digitsOnly(e.target.value) })}
          />
        </FormField>
      </div>

      <div className="form-row">
        <FormField label="Tồn kho" htmlFor="p-stock" error={errors.stock}>
          <input
            id="p-stock"
            className={`input ${errors.stock ? 'input--error' : ''}`}
            inputMode="numeric"
            value={input.stock ? input.stock.toLocaleString('vi-VN') : '0'}
            onChange={(e) => patch({ stock: digitsOnly(e.target.value) })}
          />
        </FormField>

        <FormField label="Trạng thái" htmlFor="p-active">
          <select
            id="p-active"
            className="select"
            value={input.is_active}
            onChange={(e) => patch({ is_active: Number(e.target.value) })}
          >
            <option value={1}>Đang kinh doanh</option>
            <option value={0}>Ngừng kinh doanh</option>
          </select>
        </FormField>
      </div>
    </form>
  )
}

export default ProductForm
