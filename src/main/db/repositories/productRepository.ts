import { getDb } from '../connection'
import { LOW_STOCK_THRESHOLD } from '../../../shared/constants'
import type { Product, ProductWithCategory } from '../../../shared/types'
import type { ProductInput } from '../../../shared/validation'

/** Câu SELECT dùng lại nhiều lần: sản phẩm kèm tên danh mục. */
const SELECT_WITH_CATEGORY = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`

/**
 * Lấy danh sách sản phẩm đang kinh doanh, có thể lọc theo danh mục.
 * Chỉ trả về is_active = 1 vì màn hình bán hàng không được bán hàng đã ngừng.
 */
export function findActive(categoryId?: number | null): ProductWithCategory[] {
  const db = getDb()
  if (categoryId) {
    return db
      .prepare<[number], ProductWithCategory>(
        `${SELECT_WITH_CATEGORY} WHERE p.is_active = 1 AND p.category_id = ?
         ORDER BY p.name COLLATE NOCASE`
      )
      .all(categoryId)
  }
  return db
    .prepare<[], ProductWithCategory>(
      `${SELECT_WITH_CATEGORY} WHERE p.is_active = 1 ORDER BY p.name COLLATE NOCASE`
    )
    .all()
}

/**
 * Tìm kiếm theo tên, mã SKU hoặc mã vạch.
 *
 * Tham số được truyền qua dấu ? chứ không nối chuỗi vào câu SQL — đây là cách
 * chống SQL injection: dù người dùng gõ `'; DROP TABLE products; --` thì SQLite
 * vẫn coi đó là một chuỗi cần tìm, không phải câu lệnh cần chạy.
 */
export function search(keyword: string, categoryId?: number | null): ProductWithCategory[] {
  const like = `%${keyword.trim()}%`
  const db = getDb()

  if (categoryId) {
    return db
      .prepare<[string, string, string, number], ProductWithCategory>(
        `${SELECT_WITH_CATEGORY}
         WHERE p.is_active = 1
           AND (p.name LIKE ? COLLATE NOCASE OR p.sku LIKE ? COLLATE NOCASE OR p.barcode LIKE ?)
           AND p.category_id = ?
         ORDER BY p.name COLLATE NOCASE`
      )
      .all(like, like, like, categoryId)
  }

  return db
    .prepare<[string, string, string], ProductWithCategory>(
      `${SELECT_WITH_CATEGORY}
       WHERE p.is_active = 1
         AND (p.name LIKE ? COLLATE NOCASE OR p.sku LIKE ? COLLATE NOCASE OR p.barcode LIKE ?)
       ORDER BY p.name COLLATE NOCASE`
    )
    .all(like, like, like)
}

/** Tra cứu chính xác theo mã vạch — dùng cho ô quét mã vạch ở màn bán hàng. */
export function findByBarcode(barcode: string): ProductWithCategory | undefined {
  return getDb()
    .prepare<[string], ProductWithCategory>(
      `${SELECT_WITH_CATEGORY} WHERE p.barcode = ? AND p.is_active = 1`
    )
    .get(barcode.trim())
}

export function findById(id: number): Product | undefined {
  return getDb()
    .prepare<[number], Product>(`SELECT * FROM products WHERE id = ?`)
    .get(id)
}

/** Danh sách sản phẩm sắp hết hàng để cảnh báo cho quản trị viên. */
export function findLowStock(threshold = LOW_STOCK_THRESHOLD): ProductWithCategory[] {
  return getDb()
    .prepare<[number], ProductWithCategory>(
      `${SELECT_WITH_CATEGORY}
       WHERE p.is_active = 1 AND p.stock <= ?
       ORDER BY p.stock ASC`
    )
    .all(threshold)
}

export function countProducts(): number {
  const row = getDb()
    .prepare<[], { total: number }>(
      `SELECT COUNT(*) AS total FROM products WHERE is_active = 1`
    )
    .get()
  return row?.total ?? 0
}

/**
 * Lấy TOÀN BỘ sản phẩm kể cả loại đã ngừng kinh doanh.
 * Chỉ dùng cho màn hình quản lý — màn bán hàng vẫn dùng findActive().
 */
export function findAllForAdmin(): ProductWithCategory[] {
  return getDb()
    .prepare<[], ProductWithCategory>(
      `${SELECT_WITH_CATEGORY} ORDER BY p.is_active DESC, p.name COLLATE NOCASE`
    )
    .all()
}

/** Kiểm tra trùng SKU (bỏ qua chính bản ghi đang sửa). */
export function existsBySku(sku: string, exceptId?: number): boolean {
  const row = getDb()
    .prepare<[string, number], { id: number }>(
      `SELECT id FROM products WHERE sku = ? COLLATE NOCASE AND id <> ?`
    )
    .get(sku.trim(), exceptId ?? -1)
  return row !== undefined
}

/** Kiểm tra trùng mã vạch (bỏ qua chính bản ghi đang sửa). */
export function existsByBarcode(barcode: string, exceptId?: number): boolean {
  const row = getDb()
    .prepare<[string, number], { id: number }>(
      `SELECT id FROM products WHERE barcode = ? AND id <> ?`
    )
    .get(barcode.trim(), exceptId ?? -1)
  return row !== undefined
}

export function create(input: ProductInput): Product {
  const info = getDb()
    .prepare(
      `INSERT INTO products (sku, barcode, name, category_id, price, cost, stock, unit, image_path, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.sku.trim(),
      input.barcode.trim() || null,
      input.name.trim(),
      input.category_id,
      input.price,
      input.cost,
      input.stock,
      input.unit.trim(),
      input.image_path,
      input.is_active
    )
  return findById(Number(info.lastInsertRowid))!
}

export function update(id: number, input: ProductInput): Product {
  getDb()
    .prepare(
      `UPDATE products
       SET sku = ?, barcode = ?, name = ?, category_id = ?, price = ?, cost = ?,
           stock = ?, unit = ?, image_path = ?, is_active = ?
       WHERE id = ?`
    )
    .run(
      input.sku.trim(),
      input.barcode.trim() || null,
      input.name.trim(),
      input.category_id,
      input.price,
      input.cost,
      input.stock,
      input.unit.trim(),
      input.image_path,
      input.is_active,
      id
    )
  const updated = findById(id)
  if (!updated) throw new Error('Không tìm thấy sản phẩm cần cập nhật')
  return updated
}

/**
 * "Xóa mềm": chỉ đặt is_active = 0 chứ không XÓA khỏi bảng.
 *
 * Lý do rất quan trọng về nghiệp vụ: các hóa đơn cũ vẫn trỏ tới product_id này.
 * Nếu xóa thật, những hóa đơn đó mất liên kết và báo cáo "sản phẩm bán chạy"
 * của các tháng trước sẽ sai. Xóa mềm giữ nguyên lịch sử mà sản phẩm vẫn biến
 * mất khỏi màn hình bán hàng.
 */
export function softDelete(id: number): boolean {
  const info = getDb().prepare(`UPDATE products SET is_active = 0 WHERE id = ?`).run(id)
  return info.changes > 0
}

/** Bật bán lại một sản phẩm đã ngừng kinh doanh. */
export function restore(id: number): boolean {
  const info = getDb().prepare(`UPDATE products SET is_active = 1 WHERE id = ?`).run(id)
  return info.changes > 0
}
