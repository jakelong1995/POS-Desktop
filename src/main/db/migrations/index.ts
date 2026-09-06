import type { Database } from 'better-sqlite3'
import { up as up001 } from './001_init'
import { up as up002 } from './002_seed'
import { up as up003 } from './003_refunds'

interface Migration {
  version: number
  name: string
  up: (db: Database) => void
  /**
   * Những bảng mà migration này BẮT BUỘC phải tạo ra.
   * Dùng để kiểm tra lại sau khi chạy — xem verifySchema().
   */
  tables?: string[]
  /**
   * true khi up() chạy lại nhiều lần cũng không hỏng gì (mọi câu lệnh đều có
   * IF NOT EXISTS và không đụng tới dữ liệu sẵn có). Chỉ những migration như
   * vậy mới được phép tự chạy lại để vá cấu trúc bị thiếu.
   */
  repairable?: boolean
}

/**
 * Danh sách migration, PHẢI xếp theo version tăng dần.
 * Muốn đổi cấu trúc bảng về sau thì thêm file 004_..., 005_... vào đây,
 * tuyệt đối không sửa các file cũ vì máy khách đã chạy chúng rồi.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'Tạo cấu trúc bảng',
    up: up001,
    tables: ['users', 'categories', 'products', 'invoices', 'invoice_items']
  },
  { version: 2, name: 'Nạp dữ liệu mẫu', up: up002 },
  {
    version: 3,
    name: 'Thêm bảng trả hàng',
    up: up003,
    tables: ['refunds', 'refund_items'],
    repairable: true
  }
]

/** Tên các bảng đang thực sự có trong file DB. */
function existingTables(db: Database): Set<string> {
  const rows = db
    .prepare<[], { name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .all()
  return new Set(rows.map((row) => row.name))
}

/**
 * Đối chiếu cấu trúc thật với danh sách migration đã đánh dấu là "đã chạy".
 *
 * Vì sao cần bước này? Vì user_version chỉ là một con số, nó nói "đã chạy tới
 * bước 3" chứ không chứng minh được bước 3 đã tạo ra bảng thật. Hai tình huống
 * làm hai thứ đó lệch nhau:
 *   - Máy mất điện đúng lúc SQLite đang dồn dữ liệu từ file -wal về file chính,
 *     hoặc file -wal bị xóa mất khi ứng dụng chưa đóng sạch.
 *   - Người dùng chép file pos.db từ máy khác đè lên, hoặc khôi phục từ bản sao
 *     lưu cũ mà quên chép kèm -wal.
 *
 * Nếu không kiểm tra, ứng dụng sẽ hỏng vĩnh viễn: user_version = 3 nên
 * migration 3 không bao giờ chạy lại, mà bảng thì không có, nên mọi truy vấn
 * đều báo "no such table". Không có cách nào tự thoát ra ngoài việc xóa tay file
 * dữ liệu — tức là mất sạch hóa đơn của cửa hàng.
 *
 * Cách vá: migration nào khai báo repairable (mọi câu lệnh đều IF NOT EXISTS)
 * thì cứ chạy lại để dựng nốt phần thiếu. Migration không repairable mà thiếu
 * bảng thì ném lỗi rõ ràng, vì chạy lại chúng có thể nhân đôi dữ liệu mẫu hoặc
 * ghi đè bảng đang có dữ liệu thật.
 */
function verifySchema(db: Database, appliedVersion: number): void {
  const tables = existingTables(db)

  for (const migration of MIGRATIONS) {
    if (migration.version > appliedVersion || !migration.tables) continue

    const missing = migration.tables.filter((name) => !tables.has(name))
    if (missing.length === 0) continue

    if (!migration.repairable) {
      throw new Error(
        `File dữ liệu hỏng: thiếu bảng ${missing.join(', ')} mà migration ` +
          `${migration.version} (${migration.name}) đáng lẽ đã tạo. ` +
          `Hãy khôi phục file pos.db từ bản sao lưu.`
      )
    }

    console.warn(
      `[db] Phát hiện thiếu bảng ${missing.join(', ')} dù đã ghi nhận chạy ` +
        `migration ${migration.version} — đang dựng lại`
    )

    const repair = db.transaction(() => migration.up(db))
    repair()

    console.log(`[db] Đã vá xong migration ${migration.version}: ${migration.name}`)
  }
}

/**
 * Chạy những migration chưa được áp dụng.
 *
 * Cách theo dõi tiến độ: SQLite có sẵn một số nguyên gọi là `user_version` lưu
 * ngay trong file DB. Ta dùng nó làm "đã chạy tới bước mấy" nên không cần thêm
 * bảng phụ. Lần chạy đầu user_version = 0 nên cả ba migration đều chạy;
 * những lần sau user_version = 3 nên không có gì chạy lại — nhờ vậy dữ liệu
 * mẫu không bị nạp trùng mỗi lần mở ứng dụng.
 *
 * Mỗi migration được bọc trong một transaction: nếu câu SQL nào lỗi giữa chừng,
 * toàn bộ thay đổi của bước đó bị hủy và user_version giữ nguyên, tránh để lại
 * file DB ở trạng thái dở dang.
 *
 * Chạy xong thì đối chiếu lại cấu trúc thật một lần nữa (verifySchema), vì
 * user_version có thể nói dối — xem giải thích ở hàm đó.
 */
export function runMigrations(db: Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion)

  if (pending.length === 0) {
    console.log(`[db] Cấu trúc đã ở phiên bản ${currentVersion}, không cần cập nhật`)
    verifySchema(db, currentVersion)
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

  verifySchema(db, db.pragma('user_version', { simple: true }) as number)
}
