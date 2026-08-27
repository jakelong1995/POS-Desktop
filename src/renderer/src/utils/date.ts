/**
 * Tiện ích xử lý ngày tháng cho bộ lọc và báo cáo.
 * Mọi hàm đều làm việc với chuỗi "YYYY-MM-DD" — đúng định dạng mà ô <input
 * type="date"> dùng, và cũng là định dạng cột created_at trong SQLite, nên
 * không phải chuyển đổi qua lại.
 */

/** Đổi đối tượng Date sang chuỗi YYYY-MM-DD theo giờ ĐỊA PHƯƠNG. */
export function toISODate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(): string {
  return toISODate(new Date())
}

/** Lùi lại n ngày kể từ hôm nay. daysAgo(6) + today() = khoảng 7 ngày gần nhất. */
export function daysAgo(n: number): string {
  const date = new Date()
  date.setDate(date.getDate() - n)
  return toISODate(date)
}

/** Ngày đầu tiên của tháng hiện tại. */
export function startOfMonth(): string {
  const date = new Date()
  date.setDate(1)
  return toISODate(date)
}

/** Hiển thị "2026-08-27" thành "27/08". Dùng cho nhãn trục ngang biểu đồ. */
export function shortDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

/**
 * Liệt kê toàn bộ ngày trong khoảng, kể cả ngày không bán được gì.
 *
 * Vì sao cần? Truy vấn GROUP BY chỉ trả về những ngày có hóa đơn. Nếu vẽ thẳng
 * lên biểu đồ đường thì hai ngày cách nhau một tuần sẽ bị nối bằng một đoạn
 * thẳng, nhìn như ngày nào cũng bán đều. Điền các ngày trống bằng 0 mới phản
 * ánh đúng thực tế.
 */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)

  // Chặn vòng lặp vô hạn nếu ngày nhập vào không hợp lệ
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return days

  let guard = 0
  while (cursor <= end && guard < 400) {
    days.push(toISODate(cursor))
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return days
}
