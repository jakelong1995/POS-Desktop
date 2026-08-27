/**
 * Danh sách tên các kênh IPC dùng chung giữa main và renderer.
 *
 * Quy ước đặt tên: "domain:action" — ví dụ "product:list", "invoice:create".
 * Gom vào một chỗ để tránh gõ sai chuỗi ở hai đầu (main và renderer),
 * đồng thời TypeScript sẽ báo lỗi ngay nếu dùng kênh không tồn tại.
 */
export const CHANNELS = {
  // Ứng dụng
  APP_VERSION: 'app:version',

  // Xác thực (Giai đoạn 3)
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',

  // Danh mục (Giai đoạn 5)
  CATEGORY_LIST: 'category:list',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_UPDATE: 'category:update',
  CATEGORY_DELETE: 'category:delete',

  // Sản phẩm (Giai đoạn 4 & 5)
  PRODUCT_LIST: 'product:list',
  PRODUCT_SEARCH: 'product:search',
  PRODUCT_FIND_BY_BARCODE: 'product:findByBarcode',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_LOW_STOCK: 'product:lowStock',

  // Hóa đơn (Giai đoạn 4 & 6)
  INVOICE_CHECKOUT: 'invoice:checkout',
  INVOICE_LIST: 'invoice:list',
  INVOICE_DETAIL: 'invoice:detail',

  // In ấn (Giai đoạn 6)
  PRINT_PREVIEW: 'print:preview',
  PRINT_INVOICE: 'print:invoice',

  // Báo cáo (Giai đoạn 7)
  REPORT_REVENUE_BY_DAY: 'report:revenueByDay',
  REPORT_TOP_PRODUCTS: 'report:topProducts',
  REPORT_SUMMARY: 'report:summary'
} as const

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS]
