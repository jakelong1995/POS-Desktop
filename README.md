# Phần mềm quản lý bán hàng POS

Ứng dụng desktop quản lý bán hàng cho cửa hàng bán lẻ quy mô nhỏ, **chạy offline
hoàn toàn**, không cần internet và không cần máy chủ.

> Đồ án môn Lập trình trực quan.

---

## Mục lục

1. [Tính năng](#tính-năng)
2. [Công nghệ sử dụng](#công-nghệ-sử-dụng)
3. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
4. [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt)
5. [Chạy ở chế độ phát triển](#chạy-ở-chế-độ-phát-triển)
6. [Đóng gói file .exe cho Windows](#đóng-gói-file-exe-cho-windows)
7. [Tài khoản đăng nhập mặc định](#tài-khoản-đăng-nhập-mặc-định)
8. [Phím tắt](#phím-tắt)
9. [Kiến trúc thư mục](#kiến-trúc-thư-mục)
10. [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
11. [Xử lý sự cố](#xử-lý-sự-cố)

---

## Tính năng

### 1. Đăng nhập và phân quyền
- Mật khẩu được băm bằng **bcrypt** (cost factor 10), không lưu mật khẩu dạng chữ thường.
- Hai vai trò:
  - **Quản trị viên** — dùng được toàn bộ chức năng.
  - **Thu ngân** — chỉ vào được màn hình Bán hàng và Lịch sử hóa đơn.
- Quyền được kiểm tra ở **tiến trình main**, không chỉ ẩn menu ở giao diện.

### 2. Màn hình bán hàng
- Bố cục hai cột: lưới sản phẩm bên trái, giỏ hàng bên phải.
- Tìm kiếm theo thời gian thực theo **tên / mã SKU / mã vạch** (có khử dội 200ms).
- Ô quét mã vạch riêng: quét xong máy tự nhấn Enter là sản phẩm vào giỏ ngay.
- Lọc nhanh theo danh mục.
- Giỏ hàng: tăng/giảm/nhập thẳng số lượng, xóa dòng, nhập giảm giá, tự tính
  tạm tính → giảm giá → tổng cộng.
- Thanh toán 3 phương thức (**tiền mặt / chuyển khoản / thẻ**), có nút gợi ý
  mệnh giá và tự tính tiền thối.
- Toàn bộ thao tác lưu hóa đơn và trừ tồn kho nằm trong **một transaction**.

### 3. Quản lý sản phẩm và danh mục
- Thêm / sửa / xóa đầy đủ, kiểm tra dữ liệu với thông báo tiếng Việt hiện ngay
  cạnh ô nhập.
- Chống trùng mã SKU và mã vạch ở cả 3 tầng: giao diện → main process → ràng
  buộc `UNIQUE` của SQLite.
- **Xóa mềm** sản phẩm (`is_active = 0`) để không làm hỏng hóa đơn cũ, có thể
  bật bán lại bất cứ lúc nào.
- Cảnh báo tồn kho thấp (dưới 10 đơn vị), bấm vào lọc ra danh sách cần nhập thêm.
- Chọn ảnh sản phẩm từ máy, ảnh được chép vào thư mục dữ liệu của ứng dụng.
- Không cho xóa danh mục còn sản phẩm bên trong.

### 4. Lịch sử hóa đơn
- Lọc theo khoảng ngày (có sẵn các mốc: hôm nay / 7 ngày / 30 ngày / tháng này).
- Tìm theo mã hóa đơn, phân trang ở phía database.
- Xem chi tiết từng hóa đơn, xem trước bản in và in lại.

### 5. In hóa đơn khổ 80mm
- Mẫu hóa đơn dựng bằng HTML/CSS, in qua `webContents.print()`.
- Có cửa sổ **xem trước** đúng cỡ giấy 80mm trước khi in thật.

### 6. Báo cáo
- 5 chỉ số tổng quan: doanh thu, số hóa đơn, số sản phẩm đã bán, trung bình mỗi
  hóa đơn, lợi nhuận gộp ước tính.
- **Biểu đồ đường** doanh thu theo ngày (đã điền 0 cho những ngày không bán).
- **Biểu đồ cột ngang** top 10 sản phẩm bán chạy.
- Bảng chi tiết kèm tỷ trọng doanh thu từng mặt hàng.
- Vẽ bằng **Chart.js**, đóng gói kèm ứng dụng nên chạy offline.

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Nền tảng desktop | Electron 44 |
| Giao diện | React 19 + TypeScript |
| Công cụ build | Vite 7 + electron-vite 5 |
| Cơ sở dữ liệu | SQLite qua better-sqlite3 |
| Băm mật khẩu | bcryptjs |
| Biểu đồ | Chart.js + react-chartjs-2 |
| Đóng gói | electron-builder (NSIS) |

**Nguyên tắc kiến trúc:** `contextIsolation: true`, `nodeIntegration: false`.
Giao diện **không bao giờ** truy cập database trực tiếp — mọi thao tác đều đi
qua IPC (`ipcMain.handle` ↔ `contextBridge.exposeInMainWorld`).

---

## Yêu cầu hệ thống

**Để chạy ứng dụng đã đóng gói**
- Windows 10 trở lên, 64-bit
- Khoảng 250MB dung lượng trống

**Để phát triển**
- Node.js **22.12 trở lên** (dự án được phát triển trên Node 24)
- npm 10 trở lên
- Khoảng 700MB dung lượng trống (Electron binary chiếm ~300MB)

---

## Hướng dẫn cài đặt

```bash
# 1. Tải mã nguồn về
git clone <địa-chỉ-repository>
cd POS-Desktop

# 2. Cài đặt thư viện
npm install
```

> **Lưu ý quan trọng:** lệnh `npm install` sẽ tự động chạy script `postinstall`
> để tải bản Electron (~300MB) và biên dịch lại `better-sqlite3`. Lần cài đầu
> tiên có thể mất 3–10 phút tùy tốc độ mạng, đây là điều bình thường.

---

## Chạy ở chế độ phát triển

```bash
npm run dev
```

Cửa sổ ứng dụng sẽ mở kèm DevTools. Sửa mã nguồn trong `src/renderer` là giao
diện tự cập nhật ngay (hot reload); sửa `src/main` hoặc `src/preload` thì ứng
dụng tự khởi động lại.

**Các lệnh khác**

| Lệnh | Công dụng |
|---|---|
| `npm run dev` | Chạy chế độ phát triển, có hot reload |
| `npm run typecheck` | Kiểm tra kiểu dữ liệu TypeScript toàn dự án |
| `npm run build` | Kiểm tra kiểu rồi build cả 3 tiến trình vào `out/` |
| `npm start` | Chạy thử bản đã build (không hot reload) |
| `npm run build:unpack` | Đóng gói thành thư mục, không tạo trình cài đặt |
| `npm run build:win` | Tạo trình cài đặt `.exe` cho Windows |
| `npm run build:mac` | Tạo file `.dmg` cho macOS |

---

## Đóng gói file .exe cho Windows

### Cách 1 — Dùng GitHub Actions (khuyên dùng)

Dự án đã có sẵn workflow tại `.github/workflows/build-windows.yml`. Máy ảo
Windows của GitHub sẽ build hộ, nên **không cần có máy Windows**.

1. Đẩy mã nguồn lên GitHub.
2. Vào tab **Actions** → chọn *"Đóng gói Windows (.exe)"* → bấm **Run workflow**.
3. Chờ khoảng 5–8 phút.
4. Tải file cài đặt ở mục **Artifacts** của lần chạy đó.

Hoặc gắn tag để build tự động:

```bash
git tag v1.0.0
git push --tags
```

### Cách 2 — Build trên máy Windows

```bash
npm install
npm run build:win
```

File cài đặt xuất hiện tại `release/POS Desktop-Setup-1.0.0.exe`.

> **Không nên build .exe trên macOS/Linux.** electron-builder sẽ cần Wine để tạo
> trình cài đặt NSIS, và khâu biên dịch `better-sqlite3` cho Windows rất hay lỗi.

---

## Tài khoản đăng nhập mặc định

Hai tài khoản này được tạo tự động khi mở ứng dụng lần đầu:

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn |
|---|---|---|---|
| Quản trị viên | `admin` | `123456` | Toàn quyền |
| Thu ngân | `thungan` | `123456` | Bán hàng + Lịch sử hóa đơn |

Kèm theo là **5 danh mục** và **30 sản phẩm mẫu** để dùng thử ngay.

---

## Phím tắt

Áp dụng ở màn hình Bán hàng:

| Phím | Chức năng |
|---|---|
| `F1` | Nhảy vào ô tìm kiếm |
| `F2` | Nhảy vào ô quét mã vạch |
| `F9` | Mở hộp thoại thanh toán |
| `ESC` | Hủy giỏ hàng (có hỏi lại) |
| `Enter` | Ở ô mã vạch: thêm sản phẩm vào giỏ<br>Ở ô tiền khách đưa: xác nhận thanh toán |

---

## Kiến trúc thư mục

Electron chạy ba tiến trình riêng biệt, mỗi tiến trình có một thư mục:

```
POS-Desktop/
│
├── src/
│   ├── main/                       # TIẾN TRÌNH MAIN — chạy Node.js đầy đủ
│   │   ├── index.ts                # Tạo cửa sổ, vòng đời ứng dụng, đăng ký IPC
│   │   ├── db/
│   │   │   ├── connection.ts       # Mở SQLite trong userData, bật các PRAGMA
│   │   │   ├── migrations/
│   │   │   │   ├── index.ts        # Bộ chạy migration dựa trên user_version
│   │   │   │   ├── 001_init.ts     # Tạo 5 bảng + chỉ mục
│   │   │   │   └── 002_seed.ts     # Nạp dữ liệu mẫu
│   │   │   └── repositories/       # Mỗi bảng một file, chứa toàn bộ câu SQL
│   │   │       ├── userRepository.ts
│   │   │       ├── categoryRepository.ts
│   │   │       ├── productRepository.ts
│   │   │       ├── invoiceRepository.ts
│   │   │       └── reportRepository.ts
│   │   ├── services/               # Nghiệp vụ phức tạp
│   │   │   ├── checkout.ts         # Thanh toán trong transaction
│   │   │   ├── printer.ts          # Dựng HTML 80mm và gọi lệnh in
│   │   │   ├── imageStore.ts       # Lưu ảnh + giao thức pos-image://
│   │   │   └── session.ts          # Phiên đăng nhập, requireAuth/requireAdmin
│   │   └── ipc/                    # Các handler IPC, gom theo nhóm nghiệp vụ
│   │       ├── registerHandler.ts  # Bọc try/catch cho MỌI handler
│   │       ├── auth.ts
│   │       ├── catalog.ts
│   │       ├── invoices.ts
│   │       └── reports.ts
│   │
│   ├── preload/                    # TIẾN TRÌNH PRELOAD — cầu nối an toàn
│   │   ├── index.ts                # contextBridge → window.api
│   │   └── index.d.ts              # Khai báo kiểu cho window.api
│   │
│   ├── renderer/                   # TIẾN TRÌNH RENDERER — giao diện React
│   │   ├── index.html              # Có khai báo Content Security Policy
│   │   └── src/
│   │       ├── App.tsx             # Chọn trang, bọc các Provider
│   │       ├── pages/              # Login, Sales, Products, Categories,
│   │       │                       # Invoices, Reports
│   │       ├── components/         # Modal, ConfirmDialog, Cart, ProductCard,
│   │       │                       # PaymentModal, ProductForm, Icon…
│   │       ├── hooks/              # useAuth, useCart, useShortcuts, useToast
│   │       ├── styles/             # variables.css, global.css, ui.css, page.css
│   │       └── utils/              # format.ts (VNĐ, ngày giờ), date.ts
│   │
│   └── shared/                     # DÙNG CHUNG cho cả main và renderer
│       ├── channels.ts             # Tên kênh IPC dạng "domain:action"
│       ├── constants.ts            # Vai trò, phương thức thanh toán, ngưỡng tồn kho
│       ├── types.ts                # Kiểu dữ liệu các bảng
│       ├── reportTypes.ts          # Kiểu dữ liệu kết quả truy vấn báo cáo
│       └── validation.ts           # Quy tắc kiểm tra dữ liệu dùng chung 2 phía
│
├── build/icon.png                  # Icon ứng dụng (512×512)
├── .github/workflows/              # Workflow build .exe tự động
├── electron.vite.config.ts         # Cấu hình build 3 tiến trình
├── electron-builder.yml            # Cấu hình đóng gói
└── tsconfig.node.json / .web.json  # Tách kiểu môi trường Node và DOM
```

### Luồng dữ liệu

Mọi thao tác với dữ liệu đều đi theo đúng một đường:

```
   Giao diện React                    Tiến trình Main
  ┌────────────────┐               ┌──────────────────┐
  │  Sales.tsx     │               │  ipc/invoices.ts │
  │      ↓         │   kênh IPC    │       ↓          │
  │  window.api    │ ────────────► │  services/       │
  │  .invoice      │  "invoice:    │  checkout.ts     │
  │  .checkout()   │   checkout"   │       ↓          │
  │                │               │  repositories/   │
  │                │ ◄──────────── │       ↓          │
  └────────────────┘  { success,   │  SQLite (pos.db) │
                        data }     └──────────────────┘
```

Renderer **không có** `require()`, **không đụng được** vào file hệ thống hay
database. Nó chỉ gọi được đúng những hàm đã được liệt kê trong
`src/preload/index.ts`.

---

## Cơ sở dữ liệu

### Vị trí file

Database nằm trong thư mục dữ liệu người dùng, **không** nằm cạnh file `.exe`:

| Hệ điều hành | Đường dẫn |
|---|---|
| Windows | `%APPDATA%\pos-desktop\pos.db` |
| macOS | `~/Library/Application Support/pos-desktop/pos.db` |

Nhờ vậy dữ liệu bán hàng **không bị mất khi cài đè phiên bản mới**, và ứng dụng
vẫn ghi được dữ liệu dù cài trong `C:\Program Files` (thư mục bị Windows khoá quyền ghi).

Ảnh sản phẩm nằm trong thư mục `images/` cùng cấp. **Sao lưu dữ liệu** chỉ cần
copy toàn bộ thư mục `pos-desktop` này.

### Cấu trúc bảng

```
users            id, username, password_hash, full_name, role, created_at
categories       id, name, description
products         id, sku, barcode, name, category_id, price, cost,
                 stock, unit, image_path, is_active
invoices         id, invoice_code, user_id, subtotal, discount, total,
                 payment_method, customer_paid, change_amount, created_at
invoice_items    id, invoice_id, product_id, product_name,
                 quantity, unit_price, line_total
```

**Hai điểm thiết kế đáng chú ý:**

1. **Mọi cột tiền đều là `INTEGER`, không phải `REAL`.** Đồng Việt Nam không có
   phần lẻ, mà số thực dấu phẩy động lại sinh sai số khi cộng dồn — qua hàng
   nghìn hóa đơn sẽ khiến báo cáo doanh thu lệch. Số nguyên thì chính xác tuyệt đối.

2. **`invoice_items` chép lại `product_name` và `unit_price`** thay vì chỉ lưu
   `product_id`. Sau này đổi tên hay tăng giá sản phẩm thì hóa đơn cũ in lại vẫn
   đúng như lúc khách mua.

### Migration

Ứng dụng tự tạo bảng và nạp dữ liệu mẫu ở lần chạy đầu tiên, dựa vào giá trị
`PRAGMA user_version` có sẵn trong file SQLite. Mở ứng dụng những lần sau sẽ
**không** nạp trùng dữ liệu.

Muốn đổi cấu trúc bảng về sau: thêm file `003_....ts` vào `src/main/db/migrations/`
và khai báo trong `migrations/index.ts`. **Không sửa các file migration cũ**, vì
máy khách đã chạy chúng rồi.

---

## Xử lý sự cố

<details>
<summary><b>Chạy <code>npm run dev</code> báo lỗi "Error: Electron uninstall"</b></summary>

Từ Electron 44, gói `electron` không còn tự tải file nhị phân nữa. Chạy lệnh sau:

```bash
npx install-electron
```
</details>

<details>
<summary><b>Lỗi khi cài: "was compiled against a different Node.js version"</b></summary>

`better-sqlite3` cần được biên dịch lại cho đúng phiên bản Electron:

```bash
npx electron-builder install-app-deps
```
</details>

<details>
<summary><b>Mở ứng dụng nhưng không thấy cửa sổ nào hiện lên</b></summary>

Ứng dụng chỉ cho chạy **một phiên bản** tại một thời điểm. Có thể còn tiến trình
cũ đang chạy ngầm. Trên Windows mở Task Manager kết thúc tiến trình *POS Desktop*;
trên macOS chạy:

```bash
pkill -f "POS-Desktop/node_modules/electron"
```
</details>

<details>
<summary><b>Muốn xóa toàn bộ dữ liệu, quay về trạng thái ban đầu</b></summary>

Xóa thư mục dữ liệu rồi mở lại ứng dụng, database sẽ được tạo mới kèm dữ liệu mẫu:

- Windows: xóa `%APPDATA%\pos-desktop`
- macOS: xóa `~/Library/Application Support/pos-desktop`
</details>

<details>
<summary><b>Không có máy in nhiệt, thử chức năng in thế nào?</b></summary>

Bấm **Xem trước** để thấy hóa đơn đúng khổ 80mm ngay trên màn hình. Nếu bấm
**In hóa đơn**, hộp thoại in của hệ điều hành sẽ hiện ra — chọn *"Save as PDF"*
để xuất ra file PDF thay vì in ra giấy.
</details>

<details>
<summary><b>Đổi thông tin cửa hàng in trên hóa đơn</b></summary>

Sửa hằng số `SHOP` ở đầu file `src/main/services/printer.ts`.
</details>
