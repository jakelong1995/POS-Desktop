import { daysAgo, startOfMonth, today } from '../utils/date'

export interface Range {
  from: string
  to: string
}

interface DateRangeFilterProps {
  range: Range
  onChange: (range: Range) => void
  /** Cho phép bỏ trống khoảng ngày để xem toàn bộ (dùng ở màn lịch sử hóa đơn). */
  allowAll?: boolean
}

/** Các mốc thời gian bấm một phát là chọn xong, đỡ phải gõ ngày. */
const PRESETS: Array<{ label: string; build: () => Range }> = [
  { label: 'Hôm nay', build: () => ({ from: today(), to: today() }) },
  { label: '7 ngày', build: () => ({ from: daysAgo(6), to: today() }) },
  { label: '30 ngày', build: () => ({ from: daysAgo(29), to: today() }) },
  { label: 'Tháng này', build: () => ({ from: startOfMonth(), to: today() }) }
]

/** Bộ lọc khoảng thời gian dùng chung cho màn lịch sử hóa đơn và màn báo cáo. */
function DateRangeFilter({ range, onChange, allowAll }: DateRangeFilterProps): React.JSX.Element {
  function isActive(preset: Range): boolean {
    return preset.from === range.from && preset.to === range.to
  }

  return (
    <div className="date-filter">
      <div className="date-filter__presets">
        {PRESETS.map((preset) => {
          const value = preset.build()
          return (
            <button
              key={preset.label}
              type="button"
              className={`chip ${isActive(value) ? 'chip--active' : ''}`}
              onClick={() => onChange(value)}
            >
              {preset.label}
            </button>
          )
        })}
        {allowAll && (
          <button
            type="button"
            className={`chip ${!range.from && !range.to ? 'chip--active' : ''}`}
            onClick={() => onChange({ from: '', to: '' })}
          >
            Tất cả
          </button>
        )}
      </div>

      <div className="date-filter__inputs">
        <label className="date-filter__field">
          <span>Từ ngày</span>
          <input
            className="input"
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
          />
        </label>
        <label className="date-filter__field">
          <span>Đến ngày</span>
          <input
            className="input"
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}

export default DateRangeFilter
