import { LOW_STOCK_THRESHOLD } from '@shared/constants'
import type { ProductWithCategory } from '@shared/types'
import { formatCurrency } from '../utils/format'

interface ProductCardProps {
  product: ProductWithCategory
  onSelect: (product: ProductWithCategory) => void
}

/**
 * Thẻ sản phẩm trên lưới của màn hình bán hàng.
 *
 * Sản phẩm nào chưa có ảnh thì hiện chữ cái đầu của tên thay cho ảnh — như vậy
 * lưới vẫn đều nhau, không bị lỗ hổng, mà không cần ảnh mặc định.
 * Ảnh được nạp qua giao thức riêng pos-image:// đã đăng ký ở main process.
 */
function ProductCard({ product, onSelect }: ProductCardProps): React.JSX.Element {
  const outOfStock = product.stock <= 0
  const lowStock = !outOfStock && product.stock <= LOW_STOCK_THRESHOLD

  const stockClass = outOfStock
    ? 'product-card__stock-badge--out'
    : lowStock
      ? 'product-card__stock-badge--low'
      : ''

  return (
    <button
      type="button"
      className="product-card"
      onClick={() => onSelect(product)}
      disabled={outOfStock}
      title={outOfStock ? `${product.name} — đã hết hàng` : `Thêm "${product.name}" vào giỏ`}
    >
      <div className="product-card__thumb">
        {product.image_path ? (
          <img src={`pos-image://local/${product.image_path}`} alt={product.name} />
        ) : (
          product.name.charAt(0).toUpperCase()
        )}
        <span className={`product-card__stock-badge ${stockClass}`}>
          {outOfStock ? 'Hết hàng' : `${product.stock} ${product.unit}`}
        </span>
      </div>
      <div className="product-card__body">
        <div className="product-card__name">{product.name}</div>
        <div className="product-card__sku">{product.sku}</div>
        <div className="product-card__price">{formatCurrency(product.price)}</div>
      </div>
    </button>
  )
}

export default ProductCard
