import { getDb } from '../connection'
import { LOW_STOCK_THRESHOLD } from '../../../shared/constants'
import type { Product, ProductWithCategory } from '../../../shared/types'

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
