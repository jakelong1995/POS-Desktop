import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PaymentMethod } from '@shared/constants'
import type { Category, InvoiceWithItems, ProductWithCategory } from '@shared/types'
import Cart from '../components/Cart'
import ConfirmDialog from '../components/ConfirmDialog'
import PaymentModal from '../components/PaymentModal'
import ProductCard from '../components/ProductCard'
import { useCart } from '../hooks/useCart'
import { useShortcuts } from '../hooks/useShortcuts'
import { useToast } from '../hooks/useToast'
import './Sales.css'

/**
 * ============================================================================
 * MÀN HÌNH BÁN HÀNG — màn hình chính của phần mềm
 * ============================================================================
 *
 * Bố cục hai cột: lưới sản phẩm bên trái, giỏ hàng bên phải.
 *
 * Bốn phím tắt phục vụ thao tác nhanh:
 *   F1  - nhảy vào ô tìm kiếm
 *   F2  - nhảy vào ô quét mã vạch
 *   F9  - mở hộp thoại thanh toán
 *   ESC - hủy toàn bộ giỏ hàng (có hỏi lại)
 */
function Sales(): React.JSX.Element {
  const toast = useToast()
  const cart = useCart()

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProductWithCategory[]>([])
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [barcode, setBarcode] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<InvoiceWithItems | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  /* ---------------- Nạp danh mục một lần khi mở màn hình ---------------- */
  useEffect(() => {
    async function loadCategories(): Promise<void> {
      const res = await window.api.category.list()
      if (res.success) setCategories(res.data)
      else toast.error(res.error)
    }
    void loadCategories()
  }, [toast])

  /* ---------------- Tải lại danh sách sản phẩm ---------------- */
  const reloadProducts = useCallback(
    async (search: string, category: number | null): Promise<void> => {
      const res = search.trim()
        ? await window.api.product.search(search, category)
        : await window.api.product.list(category)

      if (res.success) setProducts(res.data)
      else toast.error(res.error)
      setLoading(false)
    },
    [toast]
  )

  /**
   * Tìm kiếm theo thời gian thực có "khử dội" (debounce) 200ms.
   *
   * Không có debounce thì gõ "sữa tươi" sẽ bắn 8 truy vấn xuống SQLite, mà 7
   * kết quả đầu bị bỏ đi ngay. Chờ 200ms sau lần gõ cuối rồi mới truy vấn giúp
   * giao diện mượt hơn hẳn khi danh mục hàng hóa lớn.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reloadProducts(keyword, categoryId)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [keyword, categoryId, reloadProducts])

  /* ---------------- Thêm sản phẩm vào giỏ ---------------- */
  const addToCart = useCallback(
    (product: ProductWithCategory): void => {
      const error = cart.addProduct(product)
      if (error) toast.error(error)
    },
    [cart, toast]
  )

  /**
   * Xử lý quét mã vạch.
   *
   * Đầu đọc mã vạch hoạt động như một bàn phím: nó "gõ" rất nhanh dãy số rồi tự
   * gửi phím Enter. Vì vậy chỉ cần bắt sự kiện Enter trên ô nhập là đủ, không
   * cần thư viện điều khiển thiết bị nào cả.
   */
  async function handleBarcodeSubmit(): Promise<void> {
    const code = barcode.trim()
    if (!code) return

    const res = await window.api.product.findByBarcode(code)
    setBarcode('')

    if (!res.success) {
      toast.error(res.error)
      return
    }
    if (!res.data) {
      toast.error(`Không tìm thấy sản phẩm có mã vạch "${code}"`)
      return
    }

    addToCart(res.data)
    toast.success(`Đã thêm "${res.data.name}"`)
  }

  /* ---------------- Thanh toán ---------------- */
  async function handleConfirmPayment(
    method: PaymentMethod,
    customerPaid: number
  ): Promise<void> {
    setSubmitting(true)

    const res = await window.api.invoice.checkout({
      // Chỉ gửi mã sản phẩm và số lượng — giá do main process tự đọc từ database
      items: cart.lines.map((line) => ({
        product_id: line.product.id,
        quantity: line.quantity
      })),
      discount: cart.discount,
      payment_method: method,
      customer_paid: customerPaid
    })

    setSubmitting(false)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    setLastInvoice(res.data)
    cart.clear()
    // Tồn kho vừa bị trừ nên phải tải lại lưới sản phẩm cho khớp thực tế
    void reloadProducts(keyword, categoryId)
  }

  function handleNewOrder(): void {
    setLastInvoice(null)
    setPaymentOpen(false)
    barcodeRef.current?.focus()
  }

  /* ---------------- In hóa đơn vừa lập ---------------- */
  async function handlePreview(invoiceId: number): Promise<void> {
    const res = await window.api.print.preview(invoiceId)
    if (!res.success) toast.error(res.error)
  }

  async function handlePrint(invoiceId: number): Promise<void> {
    const res = await window.api.print.invoice(invoiceId)
    if (!res.success) toast.error(res.error)
  }

  function openPayment(): void {
    if (cart.lines.length === 0) {
      toast.info('Giỏ hàng đang trống')
      return
    }
    setPaymentOpen(true)
  }

  function requestClearCart(): void {
    if (cart.lines.length === 0) return
    setConfirmClear(true)
  }

  /* ---------------- Phím tắt ---------------- */
  const shortcuts = useMemo(
    () => ({
      F1: () => searchRef.current?.focus(),
      F2: () => barcodeRef.current?.focus(),
      F9: () => openPayment(),
      Escape: () => requestClearCart()
    }),
    // Chỉ cần tạo lại khi số dòng trong giỏ đổi — hai hàm bên trong chỉ đọc
    // cart.lines.length nên không có nguy cơ dùng dữ liệu cũ.
    [cart.lines.length]
  )

  // Tắt phím tắt khi đang mở hộp thoại để ESC của Modal không bị tranh chấp
  useShortcuts(shortcuts, !paymentOpen && !confirmClear)

  return (
    <div className="sales">
      <section className="catalog">
        <div className="catalog__search-row">
          <div className="catalog__input-wrap">
            <input
              ref={searchRef}
              className="input catalog__input"
              type="text"
              value={keyword}
              placeholder="Tìm theo tên, mã SKU hoặc mã vạch…"
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm kiếm sản phẩm"
            />
            <span className="catalog__kbd">F1</span>
          </div>

          <div className="catalog__input-wrap">
            <input
              ref={barcodeRef}
              className="input catalog__input catalog__input--barcode"
              type="text"
              value={barcode}
              placeholder="Quét mã vạch…"
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleBarcodeSubmit()
              }}
              aria-label="Ô quét mã vạch"
            />
            <span className="catalog__kbd">F2</span>
          </div>
        </div>

        <div className="catalog__filters">
          <button
            type="button"
            className={`chip ${categoryId === null ? 'chip--active' : ''}`}
            onClick={() => setCategoryId(null)}
          >
            Tất cả
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`chip ${categoryId === category.id ? 'chip--active' : ''}`}
              onClick={() => setCategoryId(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="catalog__grid">
          {loading ? (
            <p className="empty">Đang tải sản phẩm…</p>
          ) : products.length === 0 ? (
            <p className="empty">
              Không tìm thấy sản phẩm nào khớp với &ldquo;{keyword}&rdquo;
            </p>
          ) : (
            products.map((product) => (
              <ProductCard key={product.id} product={product} onSelect={addToCart} />
            ))
          )}
        </div>
      </section>

      <Cart
        cart={cart}
        onCheckout={openPayment}
        onRequestClear={requestClearCart}
        onQuantityError={toast.error}
      />

      <PaymentModal
        open={paymentOpen}
        total={cart.total}
        submitting={submitting}
        invoice={lastInvoice}
        onConfirm={(method, paid) => void handleConfirmPayment(method, paid)}
        onClose={() => setPaymentOpen(false)}
        onNewOrder={handleNewOrder}
        onPreview={(id) => void handlePreview(id)}
        onPrint={(id) => void handlePrint(id)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Hủy giỏ hàng?"
        message={`Toàn bộ ${cart.itemCount} sản phẩm trong giỏ sẽ bị xóa. Thao tác này không thể hoàn tác.`}
        confirmLabel="Hủy giỏ hàng"
        cancelLabel="Giữ lại"
        onConfirm={() => {
          cart.clear()
          setConfirmClear(false)
          toast.info('Đã hủy giỏ hàng')
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}

export default Sales
