import type { PublicUser } from '../../shared/types'
import { ROLES } from '../../shared/constants'

/**
 * Phiên đăng nhập hiện tại, lưu trong main process.
 *
 * Vì sao không lưu ở renderer? Vì renderer là trang web, người dùng có thể mở
 * DevTools sửa biến để tự nâng mình lên admin. Main process nằm ngoài tầm với
 * đó, nên mọi kiểm tra quyền thật sự đều dựa vào biến này.
 * Renderer vẫn giữ một bản sao, nhưng chỉ để quyết định hiện/ẩn menu.
 */
let currentUser: PublicUser | null = null

export function setCurrentUser(user: PublicUser | null): void {
  currentUser = user
}

export function getCurrentUser(): PublicUser | null {
  return currentUser
}

/** Bắt buộc đã đăng nhập, nếu chưa thì ném lỗi cho handler IPC bắt lại. */
export function requireAuth(): PublicUser {
  if (!currentUser) throw new Error('Bạn cần đăng nhập để thực hiện thao tác này')
  return currentUser
}

/** Bắt buộc là quản trị viên — dùng cho quản lý sản phẩm và báo cáo. */
export function requireAdmin(): PublicUser {
  const user = requireAuth()
  if (user.role !== ROLES.ADMIN) {
    throw new Error('Chức năng này chỉ dành cho quản trị viên')
  }
  return user
}
