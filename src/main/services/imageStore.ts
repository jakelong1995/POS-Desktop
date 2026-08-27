import { app, dialog, net, protocol } from 'electron'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Giao thức riêng để giao diện hiển thị được ảnh sản phẩm. */
export const IMAGE_SCHEME = 'pos-image'

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Thư mục chứa ảnh, nằm cạnh file DB trong userData. */
function imagesDir(): string {
  const dir = join(app.getPath('userData'), 'images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Khai báo giao thức pos-image:// TRƯỚC khi app sẵn sàng.
 * Bắt buộc gọi ở đầu file main, nếu gọi sau app.whenReady() sẽ không có tác dụng.
 */
export function registerImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMAGE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

/**
 * Phục vụ ảnh cho renderer qua địa chỉ dạng pos-image://local/ten-anh.jpg
 *
 * Vì sao không dùng thẳng file:// ? Vì khi chạy dev, trang web nằm ở
 * http://localhost:5173 và Chromium chặn trang http nạp tài nguyên file:// vì
 * lý do bảo mật. Tạo giao thức riêng thì cả lúc dev lẫn lúc đã đóng gói đều
 * dùng chung một đường dẫn, không phải viết hai nhánh code.
 */
export function registerImageProtocol(): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const fileName = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')

    // Chặn tấn công vượt thư mục: nếu không kiểm tra, renderer có thể yêu cầu
    // pos-image://local/../../../../etc/passwd để đọc file bất kỳ trên máy.
    if (!fileName || fileName.includes('..') || fileName.includes('/')) {
      return new Response('Tên ảnh không hợp lệ', { status: 400 })
    }

    const filePath = join(imagesDir(), fileName)
    if (!existsSync(filePath)) {
      return new Response('Không tìm thấy ảnh', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

/**
 * Mở hộp thoại chọn ảnh của hệ điều hành, chép ảnh vào thư mục userData
 * rồi trả về TÊN FILE (không phải đường dẫn đầy đủ).
 *
 * Vì sao phải chép lại? Nếu chỉ lưu đường dẫn gốc, người dùng xóa hay đổi tên
 * thư mục ảnh của họ là sản phẩm mất hình. Chép vào userData thì ảnh nằm cùng
 * chỗ với database, sao lưu hay chuyển máy chỉ cần copy một thư mục.
 */
export async function pickProductImage(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Chọn ảnh sản phẩm',
    buttonLabel: 'Chọn ảnh',
    properties: ['openFile'],
    filters: [{ name: 'Ảnh', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const sourcePath = result.filePaths[0]
  const ext = extname(sourcePath).toLowerCase()

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Chỉ chấp nhận ảnh định dạng JPG, PNG, WEBP hoặc GIF')
  }

  const { statSync } = await import('node:fs')
  if (statSync(sourcePath).size > MAX_IMAGE_BYTES) {
    throw new Error('Ảnh quá lớn, vui lòng chọn ảnh dưới 5MB')
  }

  // Tên file gồm mốc thời gian + số ngẫu nhiên để không bao giờ ghi đè ảnh cũ.
  const fileName = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  copyFileSync(sourcePath, join(imagesDir(), fileName))
  return fileName
}

/** Xóa file ảnh không còn dùng. Lỗi khi xóa được bỏ qua vì không ảnh hưởng nghiệp vụ. */
export function deleteProductImage(fileName: string | null): void {
  if (!fileName || fileName.includes('..') || fileName.includes('/')) return
  try {
    const filePath = join(imagesDir(), fileName)
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch (error) {
    console.warn('[image] Không xóa được ảnh cũ:', error)
  }
}
