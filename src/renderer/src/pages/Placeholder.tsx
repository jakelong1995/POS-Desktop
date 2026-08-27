import '../styles/page.css'

interface PlaceholderProps {
  title: string
  phase: string
}

/** Trang tạm cho các chức năng sẽ làm ở giai đoạn sau. */
function Placeholder({ title, phase }: PlaceholderProps): React.JSX.Element {
  return (
    <div className="placeholder">
      <div>
        <h2>{title}</h2>
        <p>Chức năng này sẽ được xây dựng ở {phase}.</p>
      </div>
    </div>
  )
}

export default Placeholder
