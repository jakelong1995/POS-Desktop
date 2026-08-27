/**
 * Quy tắc kiểm tra dữ liệu dùng chung cho CẢ hai phía.
 *
 * Vì sao viết một lần rồi dùng chung?
 *  - Renderer gọi để báo lỗi ngay khi người dùng đang gõ (phản hồi tức thì).
 *  - Main process gọi lại lần nữa trước khi ghi vào DB (chốt chặn thật sự,
 *    vì renderer có thể bị can thiệp qua DevTools).
 * Nếu viết hai bản riêng, sớm muộn hai bên cũng lệch nhau và sinh lỗi khó tìm.
 *
 * File này không import gì của Node hay DOM để nạp được ở cả hai môi trường.
 */

/** Dữ liệu người dùng nhập ở form sản phẩm (mọi ô đều là chuỗi khi đang gõ). */
export interface ProductInput {
  sku: string
  barcode: string
  name: string
  category_id: number | null
  price: number
  cost: number
  stock: number
  unit: string
  image_path: string | null
  is_active: number
}

export interface CategoryInput {
  name: string
  description: string
}

/** Map từ tên trường sang câu báo lỗi tiếng Việt. Rỗng nghĩa là hợp lệ. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>

const MAX_MONEY = 1_000_000_000

export function validateProduct(input: ProductInput): FieldErrors<ProductInput> {
  const errors: FieldErrors<ProductInput> = {}

  const sku = input.sku?.trim() ?? ''
  if (!sku) errors.sku = 'Vui lòng nhập mã SKU'
  else if (sku.length > 30) errors.sku = 'Mã SKU không được quá 30 ký tự'
  else if (!/^[A-Za-z0-9_-]+$/.test(sku))
    errors.sku = 'Mã SKU chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới'

  const name = input.name?.trim() ?? ''
  if (!name) errors.name = 'Vui lòng nhập tên sản phẩm'
  else if (name.length < 2) errors.name = 'Tên sản phẩm phải có ít nhất 2 ký tự'
  else if (name.length > 120) errors.name = 'Tên sản phẩm không được quá 120 ký tự'

  const barcode = input.barcode?.trim() ?? ''
  if (barcode && !/^\d{6,20}$/.test(barcode))
    errors.barcode = 'Mã vạch chỉ gồm chữ số, dài từ 6 đến 20 chữ số'

  if (!input.category_id) errors.category_id = 'Vui lòng chọn danh mục'

  if (!Number.isFinite(input.price)) errors.price = 'Giá bán không hợp lệ'
  else if (!Number.isInteger(input.price)) errors.price = 'Giá bán phải là số nguyên (VNĐ không có phần lẻ)'
  else if (input.price < 0) errors.price = 'Giá bán không được âm'
  else if (input.price > MAX_MONEY) errors.price = 'Giá bán vượt quá giới hạn cho phép'

  if (!Number.isFinite(input.cost)) errors.cost = 'Giá vốn không hợp lệ'
  else if (!Number.isInteger(input.cost)) errors.cost = 'Giá vốn phải là số nguyên'
  else if (input.cost < 0) errors.cost = 'Giá vốn không được âm'
  else if (input.cost > MAX_MONEY) errors.cost = 'Giá vốn vượt quá giới hạn cho phép'

  // Cảnh báo nghiệp vụ: bán rẻ hơn giá nhập là lỗ, thường do gõ nhầm.
  if (!errors.price && !errors.cost && input.cost > input.price && input.price > 0)
    errors.cost = 'Giá vốn đang cao hơn giá bán — kiểm tra lại kẻo bán lỗ'

  if (!Number.isInteger(input.stock)) errors.stock = 'Tồn kho phải là số nguyên'
  else if (input.stock < 0) errors.stock = 'Tồn kho không được âm'
  else if (input.stock > 1_000_000) errors.stock = 'Tồn kho vượt quá giới hạn cho phép'

  const unit = input.unit?.trim() ?? ''
  if (!unit) errors.unit = 'Vui lòng nhập đơn vị tính'
  else if (unit.length > 20) errors.unit = 'Đơn vị tính không được quá 20 ký tự'

  return errors
}

export function validateCategory(input: CategoryInput): FieldErrors<CategoryInput> {
  const errors: FieldErrors<CategoryInput> = {}

  const name = input.name?.trim() ?? ''
  if (!name) errors.name = 'Vui lòng nhập tên danh mục'
  else if (name.length < 2) errors.name = 'Tên danh mục phải có ít nhất 2 ký tự'
  else if (name.length > 60) errors.name = 'Tên danh mục không được quá 60 ký tự'

  if ((input.description?.length ?? 0) > 255)
    errors.description = 'Mô tả không được quá 255 ký tự'

  return errors
}

/** true nếu không có lỗi nào. */
export function isValid<T>(errors: FieldErrors<T>): boolean {
  return Object.keys(errors).length === 0
}

/** Gộp các câu lỗi thành một chuỗi để ném ra từ main process. */
export function firstError<T>(errors: FieldErrors<T>): string {
  const values = Object.values(errors) as string[]
  return values[0] ?? 'Dữ liệu không hợp lệ'
}
