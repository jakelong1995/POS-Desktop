import { app, shell, dialog, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { CHANNELS } from '../shared/channels'
import { closeDatabase, initDatabase } from './db/connection'
import { registerAuthHandlers } from './ipc/auth'
import { registerCatalogHandlers } from './ipc/catalog'
import { registerInvoiceHandlers } from './ipc/invoices'
import { registerReportHandlers } from './ipc/reports'
import { registerHandler } from './ipc/registerHandler'
import { registerImageProtocol, registerImageScheme } from './services/imageStore'

/** Cửa sổ chính của ứng dụng. Giữ tham chiếu để tránh bị garbage-collect. */
let mainWindow: BrowserWindow | null = null

const isDev = !app.isPackaged

/**
 * Tạo cửa sổ chính.
 *
 * Ba tuỳ chọn bảo mật quan trọng nhất:
 * - contextIsolation: true  -> code của trang web và code preload chạy ở hai
 *   ngữ cảnh JavaScript tách biệt, trang web không thể sửa hàm của preload.
 * - nodeIntegration: false  -> renderer KHÔNG có require(), không đụng được
 *   vào file system hay SQLite.
 * - sandbox: false          -> vẫn cần tắt để preload dùng được module Node
 *   khi import kênh IPC dùng chung; contextIsolation mới là lớp chắn chính.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Phần mềm bán hàng POS',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Chỉ hiện cửa sổ khi giao diện đã vẽ xong -> tránh nháy màn hình trắng.
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Mọi liên kết ra ngoài đều mở bằng trình duyệt hệ thống,
  // không cho mở cửa sổ Electron mới (tránh bị chèn trang lạ).
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Khi chạy dev, đẩy console.log/error của giao diện ra terminal.
  // Nhờ vậy lỗi trong React hiện ngay ở cửa sổ lệnh, không phải mở DevTools.
  if (isDev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log(`[renderer] ${event.message}`)
    })
  }

  // Khi chạy dev thì nạp từ Vite dev server để có hot-reload,
  // khi đã đóng gói thì nạp file HTML tĩnh trong thư mục out/.
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Đăng ký toàn bộ IPC handler, gom theo từng nhóm nghiệp vụ.
 * Các nhóm còn lại (hóa đơn, in ấn, báo cáo) sẽ được thêm ở giai đoạn sau.
 */
function registerIpcHandlers(): void {
  registerHandler(CHANNELS.APP_VERSION, () => app.getVersion())
  registerAuthHandlers()
  registerCatalogHandlers()
  registerInvoiceHandlers()
  registerReportHandlers()
}

// Chỉ cho phép chạy MỘT phiên bản ứng dụng tại một thời điểm.
// Nếu mở lần hai, hệ điều hành sẽ đưa cửa sổ đang có lên trước.
// Điều này cực kỳ quan trọng vì hai tiến trình cùng ghi một file SQLite
// có thể gây khoá file hoặc hỏng dữ liệu.
// Khai báo giao thức pos-image:// phải diễn ra trước khi app sẵn sàng.
registerImageScheme()

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.posdesktop.app')

    // Mở cơ sở dữ liệu TRƯỚC khi hiện cửa sổ. Nếu file DB hỏng hoặc không có
    // quyền ghi thì báo lỗi rõ ràng rồi thoát, thay vì để giao diện hiện lên
    // rồi mọi thao tác đều thất bại một cách khó hiểu.
    try {
      initDatabase()
    } catch (error) {
      dialog.showErrorBox(
        'Không mở được cơ sở dữ liệu',
        `Ứng dụng không thể khởi động.\n\nChi tiết: ${(error as Error).message}`
      )
      app.quit()
      return
    }

    registerImageProtocol()
    registerIpcHandlers()
    createWindow()

    // Trên macOS, bấm vào icon ở Dock khi không còn cửa sổ nào thì mở lại.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Trên Windows/Linux, đóng hết cửa sổ là thoát hẳn ứng dụng.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Đóng kết nối SQLite khi thoát để nội dung file WAL được gộp lại vào file DB.
  app.on('will-quit', () => {
    closeDatabase()
  })
}
