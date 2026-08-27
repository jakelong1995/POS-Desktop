import { CHANNELS } from '../../shared/channels'
import type { Category, Product, ProductWithCategory } from '../../shared/types'
import {
  firstError,
  isValid,
  validateCategory,
  validateProduct
} from '../../shared/validation'
import type { CategoryInput, ProductInput } from '../../shared/validation'
import * as categoryRepo from '../db/repositories/categoryRepository'
import * as productRepo from '../db/repositories/productRepository'
import { deleteProductImage, pickProductImage } from '../services/imageStore'
import { requireAdmin, requireAuth } from '../services/session'
import { registerHandler } from './registerHandler'

/* ================================================================== */
/* ĐỌC DỮ LIỆU — thu ngân cũng dùng được                               */
/* ================================================================== */

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

/* ================================================================== */
/* QUẢN LÝ — chỉ quản trị viên                                         */
/* ================================================================== */

function listAllProducts(): ProductWithCategory[] {
  requireAdmin()
  return productRepo.findAllForAdmin()
}

function listLowStock(): ProductWithCategory[] {
  requireAdmin()
  return productRepo.findLowStock()
}

/**
 * Kiểm tra dữ liệu sản phẩm trước khi ghi.
 *
 * Chia làm hai loại kiểm tra:
 *  - Kiểm tra hình thức (bắt buộc nhập, số âm, độ dài…) dùng chung quy tắc với
 *    giao diện qua file shared/validation.ts.
 *  - Kiểm tra trùng lặp SKU / mã vạch thì bắt buộc phải hỏi database, giao diện
 *    không tự làm được.
 * Cột SKU và barcode còn có ràng buộc UNIQUE ở tầng SQLite, nên dù kiểm tra ở
 * đây có sót thì database vẫn là chốt chặn cuối cùng.
 */
function assertProductValid(input: ProductInput, exceptId?: number): void {
  const errors = validateProduct(input)
  if (!isValid(errors)) throw new Error(firstError(errors))

  if (productRepo.existsBySku(input.sku, exceptId)) {
    throw new Error(`Mã SKU "${input.sku.trim()}" đã được dùng cho sản phẩm khác`)
  }
  if (input.barcode?.trim() && productRepo.existsByBarcode(input.barcode, exceptId)) {
    throw new Error(`Mã vạch "${input.barcode.trim()}" đã được dùng cho sản phẩm khác`)
  }
  if (input.category_id && !categoryRepo.findById(input.category_id)) {
    throw new Error('Danh mục đã chọn không còn tồn tại')
  }
}

function createProduct(input: ProductInput): Product {
  requireAdmin()
  assertProductValid(input)
  return productRepo.create(input)
}

function updateProduct(id: number, input: ProductInput): Product {
  requireAdmin()
  const existing = productRepo.findById(id)
  if (!existing) throw new Error('Không tìm thấy sản phẩm cần sửa')

  assertProductValid(input, id)

  // Người dùng đổi sang ảnh khác thì xóa file ảnh cũ để không rác thư mục.
  if (existing.image_path && existing.image_path !== input.image_path) {
    deleteProductImage(existing.image_path)
  }

  return productRepo.update(id, input)
}

/** Ngừng kinh doanh một sản phẩm (xóa mềm, giữ lại lịch sử hóa đơn). */
function deleteProduct(id: number): boolean {
  requireAdmin()
  const existing = productRepo.findById(id)
  if (!existing) throw new Error('Không tìm thấy sản phẩm cần xóa')
  return productRepo.softDelete(id)
}

function restoreProduct(id: number): boolean {
  requireAdmin()
  return productRepo.restore(id)
}

async function pickImage(): Promise<string | null> {
  requireAdmin()
  return pickProductImage()
}

/* ---- Danh mục ---- */

function createCategory(input: CategoryInput): Category {
  requireAdmin()
  const errors = validateCategory(input)
  if (!isValid(errors)) throw new Error(firstError(errors))
  if (categoryRepo.existsByName(input.name)) {
    throw new Error(`Danh mục "${input.name.trim()}" đã tồn tại`)
  }
  return categoryRepo.create(input.name, input.description ?? '')
}

function updateCategory(id: number, input: CategoryInput): Category {
  requireAdmin()
  if (!categoryRepo.findById(id)) throw new Error('Không tìm thấy danh mục cần sửa')

  const errors = validateCategory(input)
  if (!isValid(errors)) throw new Error(firstError(errors))
  if (categoryRepo.existsByName(input.name, id)) {
    throw new Error(`Danh mục "${input.name.trim()}" đã tồn tại`)
  }
  return categoryRepo.update(id, input.name, input.description ?? '')
}

/**
 * Xóa danh mục.
 * Chặn hẳn nếu vẫn còn sản phẩm bên trong — an toàn hơn là để sản phẩm rơi vào
 * trạng thái "chưa phân loại" mà người dùng không biết.
 */
function deleteCategory(id: number): boolean {
  requireAdmin()
  const category = categoryRepo.findById(id)
  if (!category) throw new Error('Không tìm thấy danh mục cần xóa')

  const productCount = categoryRepo.countProductsIn(id)
  if (productCount > 0) {
    throw new Error(
      `Danh mục "${category.name}" đang có ${productCount} sản phẩm. ` +
        'Hãy chuyển các sản phẩm này sang danh mục khác trước khi xóa.'
    )
  }
  return categoryRepo.remove(id)
}

export function registerCatalogHandlers(): void {
  registerHandler(CHANNELS.CATEGORY_LIST, listCategories)
  registerHandler(CHANNELS.CATEGORY_CREATE, createCategory)
  registerHandler(CHANNELS.CATEGORY_UPDATE, updateCategory)
  registerHandler(CHANNELS.CATEGORY_DELETE, deleteCategory)

  registerHandler(CHANNELS.PRODUCT_LIST, listProducts)
  registerHandler(CHANNELS.PRODUCT_LIST_ALL, listAllProducts)
  registerHandler(CHANNELS.PRODUCT_SEARCH, searchProducts)
  registerHandler(CHANNELS.PRODUCT_FIND_BY_BARCODE, findByBarcode)
  registerHandler(CHANNELS.PRODUCT_LOW_STOCK, listLowStock)
  registerHandler(CHANNELS.PRODUCT_CREATE, createProduct)
  registerHandler(CHANNELS.PRODUCT_UPDATE, updateProduct)
  registerHandler(CHANNELS.PRODUCT_DELETE, deleteProduct)
  registerHandler(CHANNELS.PRODUCT_RESTORE, restoreProduct)
  registerHandler(CHANNELS.PRODUCT_PICK_IMAGE, pickImage)
}
