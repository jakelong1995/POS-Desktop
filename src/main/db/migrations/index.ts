import type { Database } from 'better-sqlite3'
import { up as up001 } from './001_init'
import { up as up002 } from './002_seed'

interface Migration {
  version: number
  name: string
  up: (db: Database) => void
}

/**
 * Danh sách migration, PHẢI xếp theo version tăng dần.
 * Muốn đổi cấu trúc bảng về sau thì thêm file 003_..., 004_... vào đây,
 * tuyệt đối không sửa các file cũ vì máy khách đã chạy chúng rồi.
 */
const MIGRATIONS: Migration[] = [
  { version: 1, name: 'Tạo cấu trúc bảng', up: up001 },
  { version: 2, name: 'Nạp dữ liệu mẫu', up: up002 }
]

/**
 * Chạy những migration chưa được áp dụng.
 *
 * Cách theo dõi tiến độ: SQLite có sẵn một số nguyên gọi là `user_version` lưu
 * ngay trong file DB. Ta dùng nó làm "đã chạy tới bước mấy" nên không cần thêm
 * bảng phụ. Lần chạy đầu user_version = 0 nên cả hai migration đều chạy;
 * những lần sau user_version = 2 nên không có gì chạy lại — nhờ vậy dữ liệu
 * mẫu không bị nạp trùng mỗi lần mở ứng dụng.
 *
 * Mỗi migration được bọc trong một transaction: nếu câu SQL nào lỗi giữa chừng,
 * toàn bộ thay đổi của bước đó bị hủy và user_version giữ nguyên, tránh để lại
 * file DB ở trạng thái dở dang.
 */
export function runMigrations(db: Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion)

  if (pending.length === 0) {
    console.log(`[db] Cấu trúc đã ở phiên bản ${currentVersion}, không cần cập nhật`)
    return
  }

  for (const migration of pending) {
    const runInTransaction = db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })

    try {
      runInTransaction()
      console.log(`[db] Đã chạy migration ${migration.version}: ${migration.name}`)
    } catch (error) {
      console.error(`[db] Lỗi migration ${migration.version}:`, error)
      throw error
    }
  }
}
