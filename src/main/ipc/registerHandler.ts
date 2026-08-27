import { ipcMain } from 'electron'
import type { IpcResponse } from '../../shared/types'

/**
 * Bọc một hàm nghiệp vụ thành handler IPC.
 *
 * Mọi handler đều đi qua đây nên có ba lợi ích:
 *  1. Không handler nào quên try/catch — lỗi luôn thành { success: false, error }
 *     thay vì làm renderer treo ở một Promise bị reject.
 *  2. Thông báo lỗi tiếng Việt ném ra từ nghiệp vụ (ví dụ "Không đủ hàng tồn")
 *     được chuyển thẳng tới giao diện để hiển thị cho thu ngân.
 *  3. Lỗi vẫn được in ra terminal để lập trình viên lần được nguyên nhân.
 */
export function registerHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResponse<TResult>> => {
    try {
      const data = await handler(...(args as TArgs))
      return { success: true, data }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định'
      console.error(`[ipc] Lỗi ở kênh "${channel}":`, error)
      return { success: false, error: message }
    }
  })
}
