import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * Cấu hình build cho 3 tiến trình của Electron.
 *
 * - main    : chạy trong Node.js, được phép mở SQLite / đọc ghi file.
 * - preload : cầu nối an toàn giữa main và renderer (contextBridge).
 * - renderer: giao diện React, chạy trong sandbox của Chromium.
 *
 * externalizeDepsPlugin() giữ nguyên các package trong "dependencies"
 * (ở đây là better-sqlite3) thay vì bundle chúng — bắt buộc phải làm vậy
 * vì better-sqlite3 chứa file nhị phân .node không thể bundle được.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },

  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [react()],
    build: {
      // Nén mã nguồn để bản cài .exe nhẹ hơn.
      minify: 'esbuild',
      sourcemap: false,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
        output: {
          // Tách React và Chart.js ra chunk riêng để chunk chính nhỏ lại.
          manualChunks: {
            react: ['react', 'react-dom'],
            chart: ['chart.js', 'react-chartjs-2']
          }
        }
      }
    }
  }
})
