import { BrowserWindow } from 'electron'
import { PAYMENT_METHOD_LABELS } from '../../shared/constants'
import type { InvoiceWithItems } from '../../shared/types'

/** Thông tin cửa hàng in trên đầu hóa đơn. */
const SHOP = {
  name: 'CỬA HÀNG TẠP HÓA MINH LONG',
  address: '123 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh',
  phone: '0909 123 456'
}

/**
 * Chuyển ký tự đặc biệt thành thực thể HTML.
 *
 * BẮT BUỘC phải làm: tên sản phẩm do người dùng tự nhập, nếu ai đó đặt tên là
 * <script>...</script> thì đoạn mã đó sẽ chạy trong cửa sổ in. Escape xong thì
 * nó chỉ còn là chuỗi chữ hiển thị bình thường.
 */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(value: number): string {
  return value.toLocaleString('vi-VN')
}

function formatDateTime(value: string): string {
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Dựng HTML hóa đơn khổ giấy 80mm.
 *
 * Vì sao dùng HTML để in thay vì thư viện in chuyên dụng?
 *  - Không phải thêm thư viện ngoài nào, Chromium bên trong Electron tự lo phần
 *    dàn trang và gọi máy in của hệ điều hành.
 *  - Sửa mẫu hóa đơn chỉ là sửa CSS, không phải học cú pháp lệnh máy in nhiệt.
 *
 * Vùng in đặt cứng 72mm (80mm giấy trừ 4mm lề mỗi bên) và dùng font monospace
 * để các cột số thẳng hàng — đúng kiểu hóa đơn máy in nhiệt.
 */
export function buildReceiptHtml(invoice: InvoiceWithItems, withToolbar = false): string {
  const itemRows = invoice.items
    .map(
      (item) => `
      <tr class="item">
        <td colspan="3" class="item-name">${escapeHtml(item.product_name)}</td>
      </tr>
      <tr class="item">
        <td class="qty">${item.quantity} x ${money(item.unit_price)}</td>
        <td></td>
        <td class="amount">${money(item.line_total)}</td>
      </tr>`
    )
    .join('')

  const toolbar = withToolbar
    ? `<div class="toolbar no-print">
         <button id="btn-print" type="button">In hóa đơn</button>
         <button id="btn-close" type="button" class="secondary">Đóng</button>
       </div>
       <script>
         document.getElementById('btn-print').addEventListener('click', () => window.print());
         document.getElementById('btn-close').addEventListener('click', () => window.close());
       </script>`
    : ''

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${escapeHtml(invoice.invoice_code)}</title>
<style>
  /* Khổ giấy 80mm, không lề để tận dụng hết chiều ngang */
  @page { size: 80mm auto; margin: 0; }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 80mm;
    margin: 0 auto;
    padding: 4mm;
    font-family: "Courier New", Consolas, monospace;
    font-size: 12px;
    line-height: 1.45;
    color: #000;
    background: #fff;
  }

  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: 700; }

  .shop-name { font-size: 15px; font-weight: 700; margin-bottom: 2mm; }
  .shop-info { font-size: 11px; line-height: 1.4; }

  .title { font-size: 14px; font-weight: 700; margin: 3mm 0 1mm; }

  .divider { border-top: 1px dashed #000; margin: 2mm 0; }

  .meta { font-size: 11px; }
  .meta div { display: flex; justify-content: space-between; }

  table { width: 100%; border-collapse: collapse; }
  .item-name { padding-top: 1.5mm; font-weight: 700; }
  .qty    { font-size: 11px; }
  .amount { text-align: right; white-space: nowrap; }

  .totals div {
    display: flex;
    justify-content: space-between;
    margin-top: 1mm;
  }
  .grand {
    font-size: 15px;
    font-weight: 700;
    margin-top: 2mm;
    padding-top: 2mm;
    border-top: 1px solid #000;
  }

  .footer { font-size: 11px; margin-top: 3mm; }

  /* Thanh công cụ chỉ hiện khi xem trước, không bao giờ được in ra giấy */
  .toolbar {
    position: fixed; left: 0; right: 0; bottom: 0;
    display: flex; gap: 8px; padding: 10px;
    background: #f1f5f9; border-top: 1px solid #cbd5e1;
    font-family: system-ui, sans-serif;
  }
  .toolbar button {
    flex: 1; height: 40px; border: none; border-radius: 8px;
    background: #2563eb; color: #fff; font-size: 14px;
    font-weight: 600; cursor: pointer;
  }
  .toolbar button.secondary { background: #e2e8f0; color: #0f172a; }
  ${withToolbar ? 'body { padding-bottom: 70px; }' : ''}

  @media print {
    .no-print { display: none !important; }
    body { padding-bottom: 4mm; }
  }
</style>
</head>
<body>
  <div class="center">
    <div class="shop-name">${escapeHtml(SHOP.name)}</div>
    <div class="shop-info">${escapeHtml(SHOP.address)}</div>
    <div class="shop-info">ĐT: ${escapeHtml(SHOP.phone)}</div>
    <div class="title">HÓA ĐƠN BÁN HÀNG</div>
  </div>

  <div class="divider"></div>

  <div class="meta">
    <div><span>Số HĐ:</span><span class="bold">${escapeHtml(invoice.invoice_code)}</span></div>
    <div><span>Ngày:</span><span>${formatDateTime(invoice.created_at)}</span></div>
    <div><span>Thu ngân:</span><span>${escapeHtml(invoice.cashier_name)}</span></div>
  </div>

  <div class="divider"></div>

  <table>${itemRows}</table>

  <div class="divider"></div>

  <div class="totals">
    <div><span>Tạm tính</span><span>${money(invoice.subtotal)}</span></div>
    ${invoice.discount > 0 ? `<div><span>Giảm giá</span><span>-${money(invoice.discount)}</span></div>` : ''}
    <div class="grand"><span>TỔNG CỘNG</span><span>${money(invoice.total)} đ</span></div>
    <div><span>${escapeHtml(PAYMENT_METHOD_LABELS[invoice.payment_method])}</span><span>${money(invoice.customer_paid)}</span></div>
    ${invoice.change_amount > 0 ? `<div><span>Tiền thối</span><span>${money(invoice.change_amount)}</span></div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="center footer">
    <div>Cảm ơn quý khách và hẹn gặp lại!</div>
    <div>Hàng mua rồi vui lòng đổi trong 7 ngày</div>
  </div>
  ${toolbar}
</body>
</html>`
}

/** Nạp chuỗi HTML vào một cửa sổ bằng data URL, chờ vẽ xong mới trả về. */
async function loadHtml(win: BrowserWindow, html: string): Promise<void> {
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

/**
 * Mở cửa sổ XEM TRƯỚC hóa đơn.
 * Cửa sổ rộng đúng cỡ giấy 80mm để người dùng thấy trước bản in thật sự trông
 * như thế nào, kèm hai nút In và Đóng ở dưới cùng.
 */
export async function previewInvoice(
  invoice: InvoiceWithItems,
  parent: BrowserWindow | null
): Promise<boolean> {
  const win = new BrowserWindow({
    width: 380,
    height: 720,
    parent: parent ?? undefined,
    title: `Xem trước ${invoice.invoice_code}`,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  await loadHtml(win, buildReceiptHtml(invoice, true))
  win.show()
  return true
}

/**
 * In thẳng ra máy in, không qua xem trước.
 *
 * Cửa sổ được tạo ẩn (show: false), in xong thì tự đóng. silent: false nghĩa là
 * vẫn hiện hộp thoại chọn máy in của hệ điều hành — an toàn hơn cho đồ án vì
 * máy chấm có thể không có máy in nhiệt nào cả.
 */
export async function printInvoice(
  invoice: InvoiceWithItems,
  parent: BrowserWindow | null
): Promise<boolean> {
  const win = new BrowserWindow({
    show: false,
    parent: parent ?? undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  await loadHtml(win, buildReceiptHtml(invoice, false))

  return new Promise<boolean>((resolve) => {
    win.webContents.print(
      {
        silent: false,
        printBackground: true,
        margins: { marginType: 'none' },
        // Kích thước tính bằng micromet: 80mm = 80 000 µm
        pageSize: { width: 80000, height: 200000 }
      },
      (success, failureReason) => {
        if (!success && failureReason) {
          console.warn('[print] Không in được:', failureReason)
        }
        if (!win.isDestroyed()) win.close()
        resolve(success)
      }
    )
  })
}
