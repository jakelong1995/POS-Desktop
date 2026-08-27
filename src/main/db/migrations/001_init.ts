import type { Database } from 'better-sqlite3'

/**
 * Migration 001 — tạo toàn bộ cấu trúc bảng.
 *
 * Lưu ý về kiểu dữ liệu tiền tệ: mọi cột tiền đều dùng INTEGER chứ không dùng
 * REAL. Đồng Việt Nam không có phần lẻ, mà số thực dấu phẩy động lại hay sinh
 * sai số kiểu 0.1 + 0.2 = 0.30000000000000004 — cộng dồn qua hàng nghìn hóa đơn
 * sẽ khiến báo cáo doanh thu lệch. Dùng số nguyên là chính xác tuyệt đối.
 */
export function up(db: Database): void {
  db.exec(`
    -- ============ NGƯỜI DÙNG ============
    CREATE TABLE users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      full_name     TEXT    NOT NULL,
      role          TEXT    NOT NULL CHECK (role IN ('admin', 'cashier')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ============ DANH MỤC ============
    CREATE TABLE categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT
    );

    -- ============ SẢN PHẨM ============
    CREATE TABLE products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sku         TEXT    NOT NULL UNIQUE,
      barcode     TEXT    UNIQUE,
      name        TEXT    NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price       INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
      cost        INTEGER NOT NULL DEFAULT 0 CHECK (cost  >= 0),
      stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      unit        TEXT    NOT NULL DEFAULT 'cái',
      image_path  TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );

    -- Ba chỉ mục phục vụ màn hình bán hàng: quét mã vạch phải tra cứu tức thì,
    -- lọc theo danh mục và sắp xếp theo tên cũng chạy liên tục khi gõ tìm kiếm.
    CREATE INDEX idx_products_barcode  ON products(barcode);
    CREATE INDEX idx_products_category ON products(category_id);
    CREATE INDEX idx_products_name     ON products(name);

    -- ============ HÓA ĐƠN ============
    CREATE TABLE invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_code   TEXT    NOT NULL UNIQUE,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      subtotal       INTEGER NOT NULL DEFAULT 0,
      discount       INTEGER NOT NULL DEFAULT 0,
      total          INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT    NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card')),
      customer_paid  INTEGER NOT NULL DEFAULT 0,
      change_amount  INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Màn hình lịch sử và báo cáo đều lọc theo khoảng ngày nên cần chỉ mục này.
    CREATE INDEX idx_invoices_created_at ON invoices(created_at);

    -- ============ CHI TIẾT HÓA ĐƠN ============
    CREATE TABLE invoice_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
      -- Chép lại tên và đơn giá tại thời điểm bán: sau này sản phẩm có đổi tên
      -- hay tăng giá thì hóa đơn cũ in ra vẫn đúng như lúc khách mua.
      product_name TEXT    NOT NULL,
      quantity     INTEGER NOT NULL CHECK (quantity > 0),
      unit_price   INTEGER NOT NULL,
      line_total   INTEGER NOT NULL
    );

    CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
    CREATE INDEX idx_invoice_items_product ON invoice_items(product_id);
  `)
}
