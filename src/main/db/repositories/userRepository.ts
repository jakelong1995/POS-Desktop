import { getDb } from '../connection'
import type { PublicUser, UserRow } from '../../../shared/types'

/**
 * Tìm người dùng theo tên đăng nhập.
 * COLLATE NOCASE để gõ "Admin" hay "admin" đều đăng nhập được.
 */
export function findByUsername(username: string): UserRow | undefined {
  return getDb()
    .prepare<[string], UserRow>(
      `SELECT * FROM users WHERE username = ? COLLATE NOCASE`
    )
    .get(username)
}

export function findById(id: number): UserRow | undefined {
  return getDb()
    .prepare<[number], UserRow>(`SELECT * FROM users WHERE id = ?`)
    .get(id)
}

/**
 * Bỏ cột password_hash trước khi trả dữ liệu ra khỏi main process.
 * Đây là hàng rào cuối cùng: dù handler IPC có lỡ trả nguyên bản ghi thì
 * chuỗi băm mật khẩu cũng không lọt sang giao diện.
 */
export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    created_at: row.created_at
  }
}

export function countUsers(): number {
  const row = getDb()
    .prepare<[], { total: number }>(`SELECT COUNT(*) AS total FROM users`)
    .get()
  return row?.total ?? 0
}
