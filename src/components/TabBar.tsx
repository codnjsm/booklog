export type Tab = 'books' | 'quotes' | 'dict' | 'vocab' | 'stats' | 'calendar' | 'friends'

interface Props {
  active: Tab
  incomingRequestCount: number
  onChange: (tab: Tab) => void
}

const TAB = "px-3 py-2.5 sm:px-[18px] sm:py-3 bg-transparent border-none border-b-2 cursor-pointer text-sm sm:text-base font-medium font-sans transition-all duration-150 whitespace-nowrap flex items-center"

function tabClass(isActive: boolean) {
  return `${TAB} ${isActive ? 'text-ink border-accent' : 'text-dim border-transparent'}`
}

export default function TabBar({ active, incomingRequestCount, onChange }: Props) {
  return (
    <div className="flex gap-1 mb-4 sm:mb-6 border-b border-border overflow-x-auto">
      <button className={tabClass(active === 'books')} onClick={() => onChange('books')}>
        책장
      </button>
      <button className={tabClass(active === 'quotes')} onClick={() => onChange('quotes')}>
        인용구
      </button>
      <button className={tabClass(active === 'dict')} onClick={() => onChange('dict')}>
        사전
      </button>
      <button className={tabClass(active === 'vocab')} onClick={() => onChange('vocab')}>
        단어장
      </button>
      <button className={tabClass(active === 'calendar')} onClick={() => onChange('calendar')}>
        달력
      </button>
      <button className={tabClass(active === 'stats')} onClick={() => onChange('stats')}>
        통계
      </button>
      <button className={tabClass(active === 'friends')} onClick={() => onChange('friends')}>
        친구{incomingRequestCount > 0 && (
          <span className="inline-flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 ml-1 leading-none">{incomingRequestCount}</span>
        )}
      </button>
    </div>
  )
}
