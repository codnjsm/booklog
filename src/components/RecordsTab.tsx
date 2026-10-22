import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { User } from 'firebase/auth'
import type { Book, Quote, UserProfile } from '../types'
import StatsTab from './StatsTab'
import CalendarTab from './CalendarTab'
import PageHeader from './layout/PageHeader'
import ChallengeSection from './ChallengeSection'

interface Props {
  books: Book[]
  quotes: Quote[]
  goal?: number
  onSetGoal: (n: number) => void
  /** 챌린지는 로그인한 사람만 쓴다. */
  user: User | null
  friends: UserProfile[]
}

/** 통계와 달력은 둘 다 '돌아보기'라 한 섹션. 데스크톱은 둘 다 펼치고, 모바일에서만 나눈다. */
export default function RecordsTab({ books, quotes, goal, onSetGoal, user, friends }: Props) {
  // 친구 탭의 챌린지 진입점에서 오면 ?view=challenges 가 붙는다. 그 자리로 내려주고 표시는 지운다 —
  // 남겨두면 나중에 뒤로가기로 이 주소에 다시 닿을 때마다 영문 모르고 스크롤이 튄다.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('view') !== 'challenges') return
    // 챌린지가 화면에 이미 보이면 움직이지 않는다 — 위로 올라온 뒤로는 대개 보이는데,
    // 그때도 스크롤하면 제목줄이 화면 밖으로 밀려 올라간다.
    const el = document.getElementById('challenges')
    const box = el?.getBoundingClientRect()
    if (el && box && (box.top < 0 || box.bottom > window.innerHeight)) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
    const next = new URLSearchParams(searchParams)
    next.delete('view')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const [view, setView] = useState<'stats' | 'calendar'>('calendar')

  const seg = (id: 'stats' | 'calendar', label: string) => (
    <button
      onClick={() => setView(id)}
      className={`flex-1 py-1.5 rounded-md text-xs sm:text-[13px] border-none cursor-pointer transition-colors duration-150 ${
        view === id ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
      }`}
    >
      {label}
    </button>
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

      {/* 챌린지도 '돌아보기'라 같은 탭에 둔다. 세는 지표(기록한 날)가 여기 있다.
          친구 탭 진입점에서 올 때는 ?view=challenges 가 붙어 오므로 그 자리까지 내려준다. */}
      {user && (
        <div className="mt-4">
          <ChallengeSection user={user} friends={friends} />
        </div>
      )}
    </div>
  )
}
