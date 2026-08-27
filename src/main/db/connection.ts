import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { DB_FILE_NAME } from '../../shared/constants'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

/**
 * Mở (hoặc tạo mới) file cơ sở dữ liệu và chạy migration.
 *
 * File DB được đặt trong thư mục userData của hệ điều hành, ví dụ trên Windows là
 *   C:\Users\<tên>\AppData\Roaming\POS Desktop\pos.db
 * Không đặt cạnh file .exe vì thư mục Program Files bị Windows khoá quyền ghi,
 * và như vậy dữ liệu bán hàng cũng không mất khi cài đè phiên bản mới.
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), DB_FILE_NAME)
  db = new Database(dbPath)

  // Bắt buộc bật thủ công: mặc định SQLite BỎ QUA mọi ràng buộc khoá ngoại.
  // Không bật thì có thể xóa danh mục đang có sản phẩm mà không bị chặn.
  db.pragma('foreign_keys = ON')

  // WAL cho phép đọc và ghi diễn ra đồng thời, giúp màn hình báo cáo
  // không bị khựng khi thu ngân đang lưu hóa đơn.
  db.pragma('journal_mode = WAL')

  // NORMAL: nhanh hơn FULL nhiều mà vẫn an toàn khi ứng dụng bị tắt đột ngột.
  db.pragma('synchronous = NORMAL')

  runMigrations(db)

  console.log(`[db] Đã mở cơ sở dữ liệu tại: ${dbPath}`)
  return db
}

/**
 * Lấy kết nối đang mở.
 * Gọi hàm này trước khi initDatabase() là lỗi lập trình, nên ném exception luôn
 * thay vì âm thầm mở một kết nối thứ hai.
 */
export function getDb(): Database.Database {
  if (!db) throw new Error('Cơ sở dữ liệu chưa được khởi tạo')
  return db
}

/** Đóng kết nối khi thoát ứng dụng để SQLite kịp dọn file WAL. */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
