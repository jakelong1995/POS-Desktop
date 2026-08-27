import bcrypt from 'bcryptjs'
import { CHANNELS } from '../../shared/channels'
import type { LoginPayload, PublicUser } from '../../shared/types'
import * as userRepo from '../db/repositories/userRepository'
import { getCurrentUser, setCurrentUser } from '../services/session'
import { registerHandler } from './registerHandler'

/**
 * Xử lý đăng nhập.
 *
 * Quy trình: tìm user theo tên đăng nhập → so mật khẩu vừa nhập với chuỗi băm
 * đã lưu bằng bcrypt.compare (hàm này tự lấy phần "muối" nằm sẵn trong chuỗi
 * băm để băm lại mật khẩu vừa nhập rồi so sánh).
 *
 * Điểm cần chú ý về bảo mật: dù sai tên đăng nhập hay sai mật khẩu thì cũng
 * chỉ báo đúng một câu chung. Nếu báo riêng "không tồn tại tài khoản" thì kẻ
 * xấu có thể dò ra tài khoản nào có thật rồi tập trung phá mật khẩu tài khoản đó.
 */
function login(payload: LoginPayload): PublicUser {
  const username = payload?.username?.trim() ?? ''
  const password = payload?.password ?? ''

  if (!username || !password) {
    throw new Error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu')
  }

  const row = userRepo.findByUsername(username)
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng')
  }

  const user = userRepo.toPublicUser(row)
  setCurrentUser(user)
  console.log(`[auth] ${user.username} (${user.role}) đã đăng nhập`)
  return user
}

/** Đăng xuất: xóa phiên trong main process. */
function logout(): boolean {
  const user = getCurrentUser()
  if (user) console.log(`[auth] ${user.username} đã đăng xuất`)
  setCurrentUser(null)
  return true
}

export function registerAuthHandlers(): void {
  registerHandler<[LoginPayload], PublicUser>(CHANNELS.AUTH_LOGIN, login)
  registerHandler<[], boolean>(CHANNELS.AUTH_LOGOUT, logout)
}
