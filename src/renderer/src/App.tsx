import { useState } from 'react'
import AppLayout from './components/AppLayout'
import type { PageKey } from './components/AppLayout'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'
import Categories from './pages/Categories'
import Invoices from './pages/Invoices'
import Login from './pages/Login'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Sales from './pages/Sales'
import './styles/ui.css'

/**
 * Chọn trang cần hiển thị.
 *
 * Không dùng react-router vì ứng dụng desktop không có thanh địa chỉ, cũng
 * không cần nút back của trình duyệt — một biến state là đủ, và tránh thêm
 * một thư viện ngoài vào bản đóng gói.
 */
function renderPage(page: PageKey): React.JSX.Element {
  switch (page) {
    case 'sales':
      return <Sales />
    case 'products':
      return <Products />
    case 'categories':
      return <Categories />
    case 'invoices':
      return <Invoices />
    case 'reports':
      return <Reports />
  }
}

/** Chưa đăng nhập thì chỉ thấy màn hình đăng nhập, không thấy gì khác. */
function Shell(): React.JSX.Element {
  const { user } = useAuth()
  const [page, setPage] = useState<PageKey>('sales')

  if (!user) return <Login />

  return (
    <AppLayout currentPage={page} onNavigate={setPage}>
      {renderPage(page)}
    </AppLayout>
  )
}

function App(): React.JSX.Element {
  return (
    <ToastProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
