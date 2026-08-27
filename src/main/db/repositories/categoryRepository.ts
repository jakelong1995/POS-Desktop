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
