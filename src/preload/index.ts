import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../shared/channels'
import type {
  Category,
  IpcResponse,
  LoginPayload,
  ProductWithCategory,
  PublicUser
} from '../shared/types'

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
    list: () => invoke<Category[]>(CHANNELS.CATEGORY_LIST)
  },

  product: {
    list: (categoryId?: number | null) =>
      invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_LIST, categoryId),
    search: (keyword: string, categoryId?: number | null) =>
      invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_SEARCH, keyword, categoryId),
    findByBarcode: (barcode: string) =>
      invoke<ProductWithCategory | null>(CHANNELS.PRODUCT_FIND_BY_BARCODE, barcode),
    lowStock: () => invoke<ProductWithCategory[]>(CHANNELS.PRODUCT_LOW_STOCK)
  }
}

export type PosApi = typeof api

// exposeInMainWorld đặt object `api` vào window của renderer dưới dạng
// bản sao đã đóng băng, trang web không sửa được các hàm bên trong.
contextBridge.exposeInMainWorld('api', api)
