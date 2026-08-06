export type Tab = 'books' | 'quotes' | 'dict' | 'vocab' | 'stats' | 'calendar' | 'friends'

interface Props {
  active: Tab
  incomingRequestCount: number
  onChange: (tab: Tab) => void
}

export default function TabBar({ active, incomingRequestCount, onChange }: Props) {
  return (
    <div className="tabs">
      <button className={`tab${active === 'books' ? ' active' : ''}`} onClick={() => onChange('books')}>
        책장
      </button>
      <button className={`tab${active === 'quotes' ? ' active' : ''}`} onClick={() => onChange('quotes')}>
        인용구
      </button>
      <button className={`tab${active === 'dict' ? ' active' : ''}`} onClick={() => onChange('dict')}>
        사전
      </button>
      <button className={`tab${active === 'vocab' ? ' active' : ''}`} onClick={() => onChange('vocab')}>
        단어장
      </button>
      <button className={`tab${active === 'calendar' ? ' active' : ''}`} onClick={() => onChange('calendar')}>
        달력
      </button>
      <button className={`tab${active === 'stats' ? ' active' : ''}`} onClick={() => onChange('stats')}>
        통계
      </button>
      <button className={`tab${active === 'friends' ? ' active' : ''}`} onClick={() => onChange('friends')}>
        친구{incomingRequestCount > 0 && <span className="tab-badge">{incomingRequestCount}</span>}
      </button>
    </div>
  )
}
