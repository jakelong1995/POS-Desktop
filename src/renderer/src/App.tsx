import { useState } from 'react'
import AppLayout from './components/AppLayout'
import type { PageKey } from './components/AppLayout'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Placeholder from './pages/Placeholder'
import Sales from './pages/Sales'

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
      return <Placeholder title="Quản lý sản phẩm" phase="Giai đoạn 5" />
    case 'categories':
      return <Placeholder title="Quản lý danh mục" phase="Giai đoạn 5" />
    case 'invoices':
      return <Placeholder title="Lịch sử hóa đơn" phase="Giai đoạn 6" />
    case 'reports':
      return <Placeholder title="Báo cáo doanh thu" phase="Giai đoạn 7" />
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
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}

export default App
