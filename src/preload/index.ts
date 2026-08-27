import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../shared/channels'
import type {
  Category,
  CheckoutPayload,
  InvoiceWithItems,
  IpcResponse,
  LoginPayload,
  Product,
  ProductWithCategory,
  PublicUser
} from '../shared/types'
import type { CategoryInput, ProductInput } from '../shared/validation'
import type {
  DateRange,
  InvoiceListFilter,
  InvoiceListResult,
  ReportSummary,
  RevenuePoint,
  TopProduct
} from '../shared/reportTypes'

/**
 * Hàm gọi IPC dùng chung.
 * Mọi lời gọi đều trả về Promise<IpcResponse<T>> — tức là { success, data }
 * hoặc { success, error } — nên renderer không bao giờ phải bọc try/catch.
 */
function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> {
  return ipcRenderer.invoke(channel, ...args)
}

/**
 * Toàn bộ "mặt tiền" mà renderer được phép nhìn thấy.
 *
 * Đây là danh sách trắng: renderer chỉ gọi được đúng những hàm liệt kê ở đây,
 * không thể tự ý gọi ipcRenderer.invoke với kênh bất kỳ, cũng không thể
 * require('better-sqlite3') để đọc thẳng cơ sở dữ liệu.
 */
const api = {
  app: {
    getVersion: () => invoke<string>(CHANNELS.APP_VERSION)
  },

  auth: {
    login: (payload: LoginPayload) => invoke<PublicUser>(CHANNELS.AUTH_LOGIN, payload),
    logout: () => invoke<boolean>(CHANNELS.AUTH_LOGOUT)
  },

  category: {
    list: () => invoke<Category[]>(CHANNELS.CATEGORY_LIST),
    create: (input: CategoryInput) => invoke<Category>(CHANNELS.CATEGORY_CREATE, input),
    update: (id: number, input: CategoryInput) =>
      invoke<Category>(CHANNELS.CATEGORY_UPDATE, id, input),
    remove: (id: number) => invoke<boolean>(CHANNELS.CATEGORY_DELETE, id)
  },

  product: {
    list: (categoryId?: number | null) =>
      invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_LIST, categoryId),
    search: (keyword: string, categoryId?: number | null) =>
      invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_SEARCH, keyword, categoryId),
    findByBarcode: (barcode: string) =>
      invoke<ProductWithCategory | null>(CHANNELS.PRODUCT_FIND_BY_BARCODE, barcode),
    lowStock: () => invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_LOW_STOCK),
    listAll: () => invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_LIST_ALL),
    create: (input: ProductInput) => invoke<Product>(CHANNELS.PRODUCT_CREATE, input),
    update: (id: number, input: ProductInput) =>
      invoke<Product>(CHANNELS.PRODUCT_UPDATE, id, input),
    remove: (id: number) => invoke<boolean>(CHANNELS.PRODUCT_DELETE, id),
    restore: (id: number) => invoke<boolean>(CHANNELS.PRODUCT_RESTORE, id),
    pickImage: () => invoke<string | null>(CHANNELS.PRODUCT_PICK_IMAGE)
  },

  invoice: {
    checkout: (payload: CheckoutPayload) =>
      invoke<InvoiceWithItems>(CHANNELS.INVOICE_CHECKOUT, payload),
    detail: (id: number) => invoke<InvoiceWithItems>(CHANNELS.INVOICE_DETAIL, id),
    list: (filter: InvoiceListFilter) =>
      invoke<InvoiceListResult>(CHANNELS.INVOICE_LIST, filter)
  },

  print: {
    preview: (invoiceId: number) => invoke<boolean>(CHANNELS.PRINT_PREVIEW, invoiceId),
    invoice: (invoiceId: number) => invoke<boolean>(CHANNELS.PRINT_INVOICE, invoiceId)
  },

  report: {
    revenueByDay: (range: DateRange) =>
      invoke<RevenuePoint[]>(CHANNELS.REPORT_REVENUE_BY_DAY, range),
    topProducts: (range: DateRange, limit?: number) =>
      invoke<TopProduct[]>(CHANNELS.REPORT_TOP_PRODUCTS, range, limit),
    summary: (range: DateRange) => invoke<ReportSummary>(CHANNELS.REPORT_SUMMARY, range)
  }
}

export type PosApi = typeof api

// exposeInMainWorld đặt object `api` vào window của renderer dưới dạng
// bản sao đã đóng băng, trang web không sửa được các hàm bên trong.
contextBridge.exposeInMainWorld('api', api)
