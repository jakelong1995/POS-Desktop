import type { PosApi } from './index'

declare global {
  interface Window {
    api: PosApi
  }
}

export {}
