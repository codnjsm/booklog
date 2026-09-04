import { useState } from 'react'
import type { Book, Quote } from '../types'
import StatsTab from './StatsTab'
import CalendarTab from './CalendarTab'
import PageHeader from './layout/PageHeader'

interface Props {
  books: Book[]
  quotes: Quote[]
  goal?: number
  onSetGoal: (n: number) => void
}

/** 통계와 달력은 둘 다 '돌아보기'라 한 섹션. 데스크톱은 둘 다 펼치고, 모바일에서만 나눈다. */
export default function RecordsTab({ books, quotes, goal, onSetGoal }: Props) {
  const [view, setView] = useState<'stats' | 'calendar'>('calendar')

  const seg = (id: 'stats' | 'calendar', label: string) => (
    <button
      onClick={() => setView(id)}
      className={`flex-1 py-1.5 rounded-md text-[13px] border-none cursor-pointer transition-colors duration-150 ${
        view === id ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
      }`}
    >{label}</button>
  )

  return (
    <div>
      <PageHeader title="기록" />

      <div className="sm:hidden flex gap-0.5 p-0.5 mb-4 rounded-[9px] bg-surface2 border border-border">
        {seg('calendar', '달력')}
        {seg('stats', '통계')}
      </div>

      <div className={view === 'calendar' ? '' : 'hidden sm:block'}>
        <CalendarTab books={books} />
      </div>
      <div className={`${view === 'stats' ? '' : 'hidden sm:block'} sm:mt-4`}>
        <StatsTab books={books} quotes={quotes} goal={goal} onSetGoal={onSetGoal} />
      </div>
    </div>
  )
}
