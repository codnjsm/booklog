interface Props {
  onAddBook: () => void
  onExport: () => void
  onLogoClick: () => void
}

export default function Header({ onAddBook, onExport, onLogoClick }: Props) {
  return (
    <header>
      <div className="app-brand" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
        <span className="rb-logo">Booklog</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
        <button className="btn btn-secondary" onClick={onExport}>기록 내보내기</button>
        <button className="btn" onClick={onAddBook}>+ 책 추가</button>
      </div>
    </header>
  )
}
