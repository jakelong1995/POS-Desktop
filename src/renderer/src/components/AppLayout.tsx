import type { ReactNode } from 'react'
import { ROLE_LABELS } from '@shared/constants'
import Icon from './Icon'
import type { IconName } from './Icon'
import { useAuth } from '../hooks/useAuth'
import './AppLayout.css'

export type PageKey = 'sales' | 'products' | 'categories' | 'invoices' | 'reports'

interface NavItem {
  key: PageKey
  label: string
  icon: IconName
  /** true nghĩa là chỉ quản trị viên mới thấy mục này. */
  adminOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'sales', label: 'Bán hàng', icon: 'sales', adminOnly: false },
  { key: 'products', label: 'Sản phẩm', icon: 'box', adminOnly: true },
  { key: 'categories', label: 'Danh mục', icon: 'tag', adminOnly: true },
  { key: 'invoices', label: 'Hóa đơn', icon: 'receipt', adminOnly: false },
  { key: 'reports', label: 'Báo cáo', icon: 'chart', adminOnly: true }
]

interface AppLayoutProps {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  children: ReactNode
}

/**
 * Khung giao diện chung: thanh điều hướng bên trái + vùng nội dung bên phải.
 *
 * Menu được lọc theo vai trò — thu ngân chỉ thấy Bán hàng và Hóa đơn.
 * Đây mới chỉ là lớp che giấu cho gọn giao diện; việc chặn thật sự nằm ở
 * requireAdmin() trong main process, nên ẩn menu không phải là biện pháp
 * bảo mật duy nhất.
 */
function AppLayout({ currentPage, onNavigate, children }: AppLayoutProps): React.JSX.Element {
  const { user, isAdmin, logout } = useAuth()
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">POS</div>
          <div className="sidebar__brand-text">
            <strong>Bán hàng</strong>
            <span>Phiên bản 1.0</span>
          </div>
        </div>

        <nav className="sidebar__nav">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`sidebar__item ${
                currentPage === item.key ? 'sidebar__item--active' : ''
              }`}
              onClick={() => onNavigate(item.key)}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span className="sidebar__label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user?.full_name?.trim().slice(-1).toUpperCase() ?? '?'}
            </div>
            <div className="sidebar__user-info">
              <strong>{user?.full_name}</strong>
              <span>{user ? ROLE_LABELS[user.role] : ''}</span>
            </div>
          </div>
          <button type="button" className="sidebar__logout" onClick={() => void logout()}>
            <Icon name="logout" size={18} />
            <span className="sidebar__label">Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  )
}

export default AppLayout
