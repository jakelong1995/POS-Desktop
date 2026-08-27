import type { CartState } from '../hooks/useCart'
import { formatCurrency } from '../utils/format'

interface CartProps {
  cart: CartState
  onCheckout: () => void
  onRequestClear: () => void
  onQuantityError: (message: string) => void
}

/**
 * Giỏ hàng ở cột phải màn hình bán hàng.
 *
 * Mỗi dòng cho phép: bấm − / + để chỉnh số lượng, gõ thẳng số lượng, hoặc bấm ×
 * để xóa dòng. Giới hạn tồn kho được kiểm tra ngay trong useCart nên nút + tự
 * chặn khi chạm trần.
 */
function Cart({ cart, onCheckout, onRequestClear, onQuantityError }: CartProps): React.JSX.Element {
  function handleIncrease(productId: number): void {
    const error = cart.increase(productId)
    if (error) onQuantityError(error)
  }

  function handleTyped(productId: number, raw: string): void {
    const value = Number.parseInt(raw, 10)
    if (Number.isNaN(value)) return
    const error = cart.setQuantity(productId, value)
    if (error) onQuantityError(error)
  }

  return (
    <aside className="cart">
      <div className="cart__header">
        <span className="cart__title">Giỏ hàng</span>
        <span className="cart__count">
          {cart.itemCount > 0 ? `${cart.itemCount} sản phẩm` : 'Trống'}
        </span>
      </div>

      <div className="cart__lines">
        {cart.lines.length === 0 ? (
          <div className="cart__empty">
            <div>
              Chưa có sản phẩm nào.
              <br />
              Bấm vào thẻ sản phẩm bên trái
              <br />
              hoặc quét mã vạch để thêm.
            </div>
          </div>
        ) : (
          cart.lines.map((line) => (
            <div className="cart-line" key={line.product.id}>
              <div>
                <div className="cart-line__name">{line.product.name}</div>
                <div className="cart-line__unit-price">
                  {formatCurrency(line.product.price)} / {line.product.unit}
                </div>
              </div>

              <button
                type="button"
                className="cart-line__remove"
                onClick={() => cart.removeLine(line.product.id)}
                aria-label={`Xóa ${line.product.name}`}
                title="Xóa khỏi giỏ"
              >
                ×
              </button>

              <div className="cart-line__controls">
                <div className="qty">
                  <button
                    type="button"
                    className="qty__btn"
                    onClick={() => cart.decrease(line.product.id)}
                    aria-label="Giảm số lượng"
                  >
                    −
                  </button>
                  <input
                    className="qty__input"
                    type="text"
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) => handleTyped(line.product.id, e.target.value)}
                    aria-label={`Số lượng ${line.product.name}`}
                  />
                  <button
                    type="button"
                    className="qty__btn"
                    onClick={() => handleIncrease(line.product.id)}
                    disabled={line.quantity >= line.product.stock}
                    aria-label="Tăng số lượng"
                  >
                    +
                  </button>
                </div>

                <span className="cart-line__total">
                  {formatCurrency(line.product.price * line.quantity)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cart__summary">
        <div className="summary-row">
          <span className="summary-row__label">Tạm tính</span>
          <span className="summary-row__value">{formatCurrency(cart.subtotal)}</span>
        </div>

        <div className="summary-row summary-row--discount">
          <span className="summary-row__label">Giảm giá</span>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={cart.discount === 0 ? '' : cart.discount}
            placeholder="0"
            disabled={cart.lines.length === 0}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '')
              cart.setDiscount(digits ? Number.parseInt(digits, 10) : 0)
            }}
            aria-label="Số tiền giảm giá"
          />
        </div>

        <div className="summary-row summary-row--total">
          <span className="summary-row__label">Tổng cộng</span>
          <span className="summary-row__value">{formatCurrency(cart.total)}</span>
        </div>

        <div className="cart__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onRequestClear}
            disabled={cart.lines.length === 0}
            title="Hủy giỏ hàng (ESC)"
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn--success"
            onClick={onCheckout}
            disabled={cart.lines.length === 0}
            title="Thanh toán (F9)"
          >
            Thanh toán · F9
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Cart
