/**
 * Bộ biểu tượng vẽ bằng SVG nội tuyến.
 * Không dùng thư viện icon hay font ngoài để ứng dụng chạy được hoàn toàn
 * offline và bản cài không phình thêm dung lượng.
 */
const PATHS = {
  sales: 'M3 3h2l.4 2M7 13h10l3-8H5.4M7 13 5.4 5M7 13l-2 5h13M9 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0m7 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0',
  box: 'M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8M3.3 7 12 12l8.7-5M12 22V12',
  tag: 'M3 3h7l11 11-7 7L3 10zm4 4h.01',
  receipt: 'M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5zm4 6h8M8 12h8M8 16h5',
  chart: 'M3 3v18h18M7 15l4-5 4 3 5-7',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  lock: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1m3 0V7a4 4 0 0 1 8 0v4',
  warning: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0'
} as const

export type IconName = keyof typeof PATHS

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

function Icon({ name, size = 20, className }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

export default Icon
