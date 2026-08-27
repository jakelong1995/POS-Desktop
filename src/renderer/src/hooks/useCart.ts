import { useCallback, useMemo, useState } from 'react'
import type { CartLine, ProductWithCategory } from '@shared/types'

export interface CartState {
  lines: CartLine[]
  discount: number
  subtotal: number
  total: number
  itemCount: number
  addProduct: (product: ProductWithCategory) => string | null
  setQuantity: (productId: number, quantity: number) => string | null
  increase: (productId: number) => string | null
  decrease: (productId: number) => void
  removeLine: (productId: number) => void
  clear: () => void
  setDiscount: (value: number) => void
}

/**
 * Quản lý toàn bộ trạng thái giỏ hàng.
 *
 * Tách thành hook riêng thay vì viết thẳng trong màn hình bán hàng vì hai lý do:
 *  - Logic tính tiền nằm gọn một chỗ, dễ đọc và dễ giải thích khi bảo vệ.
 *  - Component Sales chỉ còn lo phần hiển thị.
 *
 * Các hàm thao tác trả về chuỗi lỗi tiếng Việt (hoặc null nếu thành công) để
 * màn hình hiển thị thông báo, thay vì tự ném exception.
 */
export function useCart(): CartState {
  const [lines, setLines] = useState<CartLine[]>([])
  const [discount, setDiscountValue] = useState(0)

  /**
   * Thêm sản phẩm vào giỏ.
   * Nếu sản phẩm đã có trong giỏ thì tăng số lượng lên 1 thay vì tạo dòng mới —
   * đây là hành vi người bán hàng mong đợi khi quét mã vạch cùng một món hai lần.
   */
  const addProduct = useCallback((product: ProductWithCategory): string | null => {
    if (product.stock <= 0) {
      return `"${product.name}" đã hết hàng`
    }

    let errorMessage: string | null = null

    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id)

      if (!existing) {
        return [...prev, { product, quantity: 1 }]
      }

      // Không cho đặt số lượng vượt quá tồn kho ngay từ giao diện.
      // Main process vẫn kiểm tra lại lần nữa lúc thanh toán.
      if (existing.quantity + 1 > product.stock) {
        errorMessage = `"${product.name}" chỉ còn ${product.stock} ${product.unit}`
        return prev
      }

      return prev.map((line) =>
        line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line
      )
    })

    return errorMessage
  }, [])

  const setQuantity = useCallback((productId: number, quantity: number): string | null => {
    let errorMessage: string | null = null

    setLines((prev) => {
      const line = prev.find((l) => l.product.id === productId)
      if (!line) return prev

      if (!Number.isFinite(quantity) || quantity < 1) {
        return prev.filter((l) => l.product.id !== productId)
      }

      const wanted = Math.floor(quantity)
      if (wanted > line.product.stock) {
        errorMessage = `"${line.product.name}" chỉ còn ${line.product.stock} ${line.product.unit}`
        return prev.map((l) =>
          l.product.id === productId ? { ...l, quantity: l.product.stock } : l
        )
      }

      return prev.map((l) => (l.product.id === productId ? { ...l, quantity: wanted } : l))
    })

    return errorMessage
  }, [])

  const increase = useCallback(
    (productId: number): string | null => {
      const line = lines.find((l) => l.product.id === productId)
      if (!line) return null
      return setQuantity(productId, line.quantity + 1)
    },
    [lines, setQuantity]
  )

  const decrease = useCallback(
    (productId: number): void => {
      const line = lines.find((l) => l.product.id === productId)
      if (!line) return
      setQuantity(productId, line.quantity - 1)
    },
    [lines, setQuantity]
  )

  const removeLine = useCallback((productId: number): void => {
    setLines((prev) => prev.filter((line) => line.product.id !== productId))
  }, [])

  const clear = useCallback((): void => {
    setLines([])
    setDiscountValue(0)
  }, [])

  // Tạm tính = tổng thành tiền các dòng. Tính lại mỗi khi giỏ đổi nhờ useMemo,
  // tránh tính lặp ở nhiều chỗ trong giao diện.
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [lines]
  )

  /** Giảm giá không được vượt quá tạm tính, và tổng tiền không bao giờ âm. */
  const setDiscount = useCallback((value: number): void => {
    setDiscountValue(Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
  }, [])

  const safeDiscount = Math.min(discount, subtotal)
  const total = subtotal - safeDiscount
  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines]
  )

  return {
    lines,
    discount: safeDiscount,
    subtotal,
    total,
    itemCount,
    addProduct,
    setQuantity,
    increase,
    decrease,
    removeLine,
    clear,
    setDiscount
  }
}
