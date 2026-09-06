import type { Database } from 'better-sqlite3'

/**
 * Migration 003 — nghiệp vụ trả hàng / hoàn tiền.
 *
 * Vì sao phải là hai bảng riêng chứ không sửa thẳng bảng invoices?
 * Hóa đơn là chứng từ đã phát hành cho khách, sổ sách kế toán không cho phép
 * sửa lại con số trên đó. Trả hàng là một chứng từ NGƯỢC CHIỀU, ghi thêm vào
 * chứ không ghi đè. Nhờ vậy:
 *   - Bản in hóa đơn gốc vẫn khớp với tờ giấy khách đang cầm.
 *   - Một hóa đơn có thể trả nhiều lần (trả 1 món hôm nay, 1 món tuần sau),
 *     mỗi lần là một phiếu riêng có mã, có người lập, có thời điểm.
 *   - Báo cáo tính được cả doanh thu gộp lẫn doanh thu thuần.
 *
 * Mọi câu lệnh ở đây đều dùng IF NOT EXISTS để chạy lại được nhiều lần mà không
 * hỏng gì. Đó là điều kiện để cơ chế tự sửa trong index.ts dựng lại được bảng
 * khi user_version nói "đã chạy rồi" mà bảng thì không có — xem `repairable`.
 */
export function up(db: Database): void {
  db.exec(`
    -- ============ PHIẾU TRẢ HÀNG ============
    CREATE TABLE IF NOT EXISTS refunds (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_code TEXT    NOT NULL UNIQUE,
      invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      reason      TEXT,
      -- Số tiền thực trả lại khách, đã trừ phần giảm giá phân bổ cho các món
      -- được trả. Luôn > 0 vì phiếu trả 0 đồng là vô nghĩa.
      total       INTEGER NOT NULL CHECK (total >= 0),
      -- 1 = hàng còn tốt, nhập lại kho; 0 = hàng hỏng, không nhập lại.
      restock     INTEGER NOT NULL DEFAULT 1 CHECK (restock IN (0, 1)),
      -- 'partial' hay 'full' — lưu sẵn để danh sách khỏi phải tính lại.
      kind        TEXT    NOT NULL CHECK (kind IN ('partial', 'full')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_refunds_invoice    ON refunds(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);

    -- ============ CHI TIẾT PHIẾU TRẢ ============
    CREATE TABLE IF NOT EXISTS refund_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_id       INTEGER NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
      -- Trỏ về đúng DÒNG của hóa đơn gốc, không chỉ trỏ về sản phẩm: một hóa
      -- đơn có thể có hai dòng cùng sản phẩm (bán hai lần giá khác nhau), phải
      -- biết khách trả dòng nào mới kiểm được "đã trả quá số đã mua" hay chưa.
      invoice_item_id INTEGER NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
      product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name    TEXT    NOT NULL,
      quantity        INTEGER NOT NULL CHECK (quantity > 0),
      -- Đơn giá HOÀN, tức đơn giá bán đã trừ phần giảm giá được phân bổ.
      unit_price      INTEGER NOT NULL,
      line_total      INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_refund_items_refund       ON refund_items(refund_id);
    CREATE INDEX IF NOT EXISTS idx_refund_items_invoice_item ON refund_items(invoice_item_id);
  `)
}
