import { getDb } from '../connection'
import type { Category } from '../../../shared/types'

/** Lấy toàn bộ danh mục, sắp xếp theo tên cho dễ tìm trên giao diện. */
export function findAll(): Category[] {
  return getDb()
    .prepare<[], Category>(`SELECT * FROM categories ORDER BY name COLLATE NOCASE`)
    .all()
}

export function findById(id: number): Category | undefined {
  return getDb()
    .prepare<[number], Category>(`SELECT * FROM categories WHERE id = ?`)
    .get(id)
}

export function countCategories(): number {
  const row = getDb()
    .prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM categories`)
    .get()
  return row?.total ?? 0
}

/** Đếm số sản phẩm đang thuộc một danh mục — dùng để cảnh báo trước khi xóa. */
export function countProductsIn(categoryId: number): number {
  const row = getDb()
    .prepare<[number], { total: number }>(
      `SELECT COUNT(*) AS total FROM products WHERE category_id = ? AND is_active = 1`
    )
    .get(categoryId)
  return row?.total ?? 0
}

/** Kiểm tra trùng tên danh mục, bỏ qua chính bản ghi đang sửa. */
export function existsByName(name: string, exceptId?: number): boolean {
  const row = getDb()
    .prepare<[string, number], { id: number }>(
      `SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id <> ?`
    )
    .get(name.trim(), exceptId ?? -1)
  return row !== undefined
}

export function create(name: string, description: string): Category {
  const info = getDb()
    .prepare(`INSERT INTO categories (name, description) VALUES (?, ?)`)
    .run(name.trim(), description.trim() || null)
  return findById(Number(info.lastInsertRowid))!
}

export function update(id: number, name: string, description: string): Category {
  getDb()
    .prepare(`UPDATE categories SET name = ?, description = ? WHERE id = ?`)
    .run(name.trim(), description.trim() || null, id)
  const updated = findById(id)
  if (!updated) throw new Error('Không tìm thấy danh mục cần cập nhật')
  return updated
}

/**
 * Xóa danh mục.
 * Ràng buộc ON DELETE SET NULL ở bảng products sẽ tự gỡ liên kết, nên sản phẩm
 * không bị xóa theo mà chỉ trở thành "chưa phân loại".
 */
export function remove(id: number): boolean {
  const info = getDb().prepare(`DELETE FROM categories WHERE id = ?`).run(id)
  return info.changes > 0
}
