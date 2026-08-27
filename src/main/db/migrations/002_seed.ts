import type { Database } from 'better-sqlite3'
import bcrypt from 'bcryptjs'

/**
 * Migration 002 — nạp dữ liệu mẫu cho lần chạy đầu tiên.
 *
 * Mật khẩu KHÔNG bao giờ lưu dạng chữ thường. bcrypt.hashSync băm mật khẩu kèm
 * một chuỗi "muối" ngẫu nhiên, nên hai người đặt trùng mật khẩu vẫn cho ra hai
 * chuỗi băm khác nhau, và không thể đảo ngược chuỗi băm về mật khẩu gốc.
 * Số 10 là "cost factor": mỗi lần tăng 1 thì thời gian băm tăng gấp đôi —
 * đủ chậm để chống dò mật khẩu, đủ nhanh để đăng nhập không bị khựng.
 */
export function up(db: Database): void {
  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES (?, ?, ?, ?)`
  )
  insertUser.run('admin', bcrypt.hashSync('123456', 10), 'Quản trị viên', 'admin')
  insertUser.run('thungan', bcrypt.hashSync('123456', 10), 'Nguyễn Thị Thu Ngân', 'cashier')

  const insertCategory = db.prepare(
    `INSERT INTO categories (name, description) VALUES (?, ?)`
  )
  const categories: Array<[string, string]> = [
    ['Đồ uống', 'Nước ngọt, nước suối, trà, cà phê đóng chai'],
    ['Bánh kẹo', 'Bánh quy, kẹo, snack các loại'],
    ['Sữa và chế phẩm', 'Sữa tươi, sữa đặc, sữa chua, phô mai'],
    ['Thực phẩm khô', 'Mì gói, gạo, gia vị, dầu ăn'],
    ['Đồ gia dụng', 'Hóa phẩm tẩy rửa, giấy, đồ dùng hằng ngày']
  ]
  for (const [name, description] of categories) {
    insertCategory.run(name, description)
  }

  // [sku, mã vạch, tên, id danh mục, giá bán, giá vốn, tồn kho, đơn vị]
  const products: Array<[string, string, string, number, number, number, number, string]> = [
    // --- Đồ uống ---
    ['DU001', '8930001000015', 'Nước suối Lavie 500ml', 1, 5000, 3500, 240, 'chai'],
    ['DU002', '8930001000022', 'Coca-Cola lon 330ml', 1, 10000, 7500, 180, 'lon'],
    ['DU003', '8930001000039', 'Pepsi lon 330ml', 1, 10000, 7500, 156, 'lon'],
    ['DU004', '8930001000046', 'Trà xanh Không Độ 500ml', 1, 12000, 9000, 96, 'chai'],
    ['DU005', '8930001000053', 'Nước tăng lực Sting dâu 330ml', 1, 12000, 9000, 8, 'lon'],
    ['DU006', '8930001000060', 'Cà phê sữa Highlands lon 235ml', 1, 15000, 11000, 72, 'lon'],

    // --- Bánh kẹo ---
    ['BK001', '8930002000014', 'Bánh Oreo socola 119g', 2, 18000, 13500, 60, 'gói'],
    ['BK002', '8930002000021', 'Bánh Chocopie hộp 12 cái', 2, 55000, 42000, 24, 'hộp'],
    ['BK003', '8930002000038', 'Kẹo dẻo Haribo 80g', 2, 32000, 24000, 5, 'gói'],
    ['BK004', '8930002000045', 'Bánh quy Cosy hộp 336g', 2, 48000, 36000, 36, 'hộp'],
    ['BK005', '8930002000052', 'Snack Oishi tôm cay 40g', 2, 7000, 5000, 150, 'gói'],
    ['BK006', '8930002000069', 'Kẹo Alpenliebe hũ 350g', 2, 25000, 18500, 42, 'hũ'],

    // --- Sữa và chế phẩm ---
    ['SUA001', '8930003000013', 'Sữa tươi Vinamilk có đường 1L', 3, 34000, 27000, 48, 'hộp'],
    ['SUA002', '8930003000020', 'Sữa đặc Ông Thọ 380g', 3, 25000, 19500, 66, 'lon'],
    ['SUA003', '8930003000037', 'Sữa chua Vinamilk vỉ 4 hộp', 3, 28000, 21000, 30, 'vỉ'],
    ['SUA004', '8930003000044', 'Sữa Milo hộp 180ml', 3, 9000, 6800, 120, 'hộp'],
    ['SUA005', '8930003000051', 'Phô mai Con Bò Cười 8 miếng', 3, 42000, 33000, 6, 'hộp'],
    ['SUA006', '8930003000068', 'Sữa đậu nành Fami 200ml', 3, 6000, 4200, 144, 'hộp'],

    // --- Thực phẩm khô ---
    ['TPK001', '8930004000012', 'Mì Hảo Hảo tôm chua cay', 4, 4500, 3200, 300, 'gói'],
    ['TPK002', '8930004000029', 'Mì Omachi sườn hầm', 4, 8000, 6000, 180, 'gói'],
    ['TPK003', '8930004000036', 'Phở ăn liền Đệ Nhất bò', 4, 9500, 7000, 90, 'gói'],
    ['TPK004', '8930004000043', 'Gạo ST25 túi 5kg', 4, 195000, 165000, 20, 'túi'],
    ['TPK005', '8930004000050', 'Dầu ăn Neptune 1L', 4, 58000, 47000, 40, 'chai'],
    ['TPK006', '8930004000067', 'Nước mắm Nam Ngư 500ml', 4, 32000, 25000, 54, 'chai'],
    ['TPK007', '8930004000074', 'Đường trắng Biên Hòa 1kg', 4, 26000, 20000, 7, 'túi'],

    // --- Đồ gia dụng ---
    ['GD001', '8930005000011', 'Nước rửa chén Sunlight 750ml', 5, 32000, 25000, 45, 'chai'],
    ['GD002', '8930005000028', 'Bột giặt Omo 800g', 5, 45000, 36000, 38, 'túi'],
    ['GD003', '8930005000035', 'Nước lau sàn Gift hương chanh 1L', 5, 38000, 30000, 26, 'chai'],
    ['GD004', '8930005000042', 'Giấy vệ sinh Bless You 10 cuộn', 5, 62000, 49000, 18, 'bịch'],
    ['GD005', '8930005000059', 'Kem đánh răng P/S trà xanh 180g', 5, 28000, 21000, 9, 'tuýp']
  ]

  const insertProduct = db.prepare(
    `INSERT INTO products (sku, barcode, name, category_id, price, cost, stock, unit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  for (const p of products) {
    insertProduct.run(...p)
  }
}
