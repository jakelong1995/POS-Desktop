/**
 * Định dạng số tiền theo kiểu Việt Nam: 1250000 -> "1.250.000 ₫"
 * Dùng Intl có sẵn của trình duyệt nên không cần thư viện ngoài.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(value ?? 0)
}

/** Định dạng số có dấu chấm ngăn cách hàng nghìn: 1250000 -> "1.250.000" */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value ?? 0)
}

/** Định dạng ngày giờ đầy đủ: "27/08/2026 14:35" */
export function formatDateTime(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

/** Định dạng ngày: "27/08/2026" */
export function formatDate(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d)
}
