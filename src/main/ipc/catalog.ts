import { CHANNELS } from '../../shared/channels'
import type { Category, ProductWithCategory } from '../../shared/types'
import * as categoryRepo from '../db/repositories/categoryRepository'
import * as productRepo from '../db/repositories/productRepository'
import { requireAdmin, requireAuth } from '../services/session'
import { registerHandler } from './registerHandler'

/**
 * Các handler đọc dữ liệu danh mục / sản phẩm.
 * Phần thêm - sửa - xóa sẽ được bổ sung ở Giai đoạn 5.
 *
 * Chú ý requireAuth() ở đầu mỗi hàm: quyền được kiểm tra ở main process chứ
 * không chỉ dựa vào việc renderer có hiện menu hay không.
 */

function listCategories(): Category[] {
  requireAuth()
  return categoryRepo.findAll()
}

function listProducts(categoryId?: number | null): ProductWithCategory[] {
  requireAuth()
  return productRepo.findActive(categoryId)
}

function searchProducts(keyword: string, categoryId?: number | null): ProductWithCategory[] {
  requireAuth()
  if (!keyword || !keyword.trim()) return productRepo.findActive(categoryId)
  return productRepo.search(keyword, categoryId)
}

function findByBarcode(barcode: string): ProductWithCategory | null {
  requireAuth()
  return productRepo.findByBarcode(barcode) ?? null
}

/** Cảnh báo tồn kho thấp — chỉ quản trị viên mới cần xem. */
function listLowStock(): ProductWithCategory[] {
  requireAdmin()
  return productRepo.findLowStock()
}

export function registerCatalogHandlers(): void {
  registerHandler<[], Category[]>(CHANNELS.CATEGORY_LIST, listCategories)
  registerHandler<[number | null | undefined], ProductWithCategory[]>(
    CHANNELS.PRODUCT_LIST,
    listProducts
  )
  registerHandler<[string, number | null | undefined], ProductWithCategory[]>(
    CHANNELS.PRODUCT_SEARCH,
    searchProducts
  )
  registerHandler<[string], ProductWithCategory | null>(
    CHANNELS.PRODUCT_FIND_BY_BARCODE,
    findByBarcode
  )
  registerHandler<[], ProductWithCategory[]>(CHANNELS.PRODUCT_LOW_STOCK, listLowStock)
}
