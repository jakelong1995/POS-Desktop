import { useEffect } from 'react'

/** Bản đồ phím tắt: tên phím -> hàm xử lý. */
export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>

/**
 * Đăng ký phím tắt toàn màn hình.
 *
 * Vì sao phần mềm bán hàng cần phím tắt? Thu ngân làm việc bằng bàn phím và đầu
 * đọc mã vạch, mỗi lần phải với tay bấm chuột là chậm vài giây — nhân với vài
 * trăm đơn mỗi ngày thì rất đáng kể.
 *
 * preventDefault() được gọi cho các phím F vì mặc định trình duyệt gán sẵn chức
 * năng khác (F1 mở trợ giúp, F3 tìm kiếm…), không chặn thì phím tắt của mình
 * không chạy.
 */
export function useShortcuts(shortcuts: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent): void {
      const handler = shortcuts[event.key]
      if (!handler) return

      event.preventDefault()
      handler(event)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}
