import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useAppUI, type Tab } from '../../contexts/AppUIContext'
import type { SyncStatus } from '../../hooks/useData'
import {
  IconHome,
  IconBooks,
  IconCollection,
  IconRecords,
  IconFriends,
  IconMore,
  IconExport,
  IconSun,
  IconMoon,
} from './icons'

interface Props {
  user: User | null
  syncStatus: SyncStatus
  bookCount: number
  collectionCount: number
  incomingCount: number
  onExport: () => void
  children: ReactNode
}

const NAV: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'home', label: '홈', Icon: IconHome },
  { id: 'books', label: '서재', Icon: IconBooks },
  { id: 'collection', label: '모음', Icon: IconCollection },
  { id: 'records', label: '기록', Icon: IconRecords },
  { id: 'friends', label: '친구', Icon: IconFriends },
]

// 모바일 하단 탭 5개. 친구는 '더보기' 안으로 내린다.
const MOBILE_NAV: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  ...NAV.filter((n) => n.id !== 'friends'),
  { id: 'more', label: '더보기', Icon: IconMore },
]

function Badge({ count }: { count: number }) {
  return <span className="text-danger text-[10px] font-bold">{count > 99 ? '99+' : count}</span>
}

export default function AppLayout({
  user,
  syncStatus,
  bookCount,
  collectionCount,
  incomingCount,
  onExport,
  children,
}: Props) {
  const { tab, changeTab, theme, toggleTheme } = useAppUI()

  const counts: Partial<Record<Tab, number>> = { books: bookCount, collection: collectionCount }
  const syncLabel = syncStatus === 'saving' ? '저장 중…' : syncStatus === 'error' ? '저장 실패' : '동기화됨'
  const syncColor = syncStatus === 'saving' ? 'bg-accent' : syncStatus === 'error' ? 'bg-danger' : 'bg-ok'

  return (
    <div className="min-h-screen flex bg-bg">
      <aside className="hidden sm:flex w-[var(--sidebar-w)] flex-shrink-0 flex-col gap-7 bg-surface border-r border-border px-3.5 py-6 fixed inset-y-0 left-0">
        <button
          className="font-mono text-xl font-bold tracking-[-0.02em] text-[var(--logo)] px-2.5 text-left bg-transparent border-none cursor-pointer"
          onClick={() => changeTab('home')}
        >
          Booklog
        </button>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => changeTab(id)}
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-sans border-none cursor-pointer text-left transition-colors duration-150 ${active ? 'bg-accentsoft text-accent font-medium' : 'bg-transparent text-dim hover:text-ink'}`}
              >
                <Icon />
                <span>{label}</span>
                <span className="flex-1" />
                {id === 'friends' && incomingCount > 0 ? (
                  <Badge count={incomingCount} />
                ) : (
                  counts[id] !== undefined && (
                    <span className="font-mono text-xs sm:text-[13px] text-dim">{counts[id]}</span>
                  )
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-0.5 pt-3.5 border-t border-border">
          <button
            onClick={onExport}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] sm:text-sm text-dim bg-transparent border-none cursor-pointer text-left hover:text-ink"
          >
            <IconExport />
            <span>기록 내보내기</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] sm:text-sm text-dim bg-transparent border-none cursor-pointer text-left hover:text-ink"
          >
            {theme === 'light' ? <IconSun /> : <IconMoon />}
            <span>{theme === 'light' ? '라이트 모드' : '다크 모드'}</span>
          </button>
          {user && (
            <button
              onClick={() => changeTab('more')}
              className="flex items-center gap-2.5 p-2.5 mt-1.5 rounded-lg bg-surface2 border-none cursor-pointer text-left w-full"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  alt=""
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </span>
              )}
              <span className="flex flex-col gap-px min-w-0">
                <span className="text-xs sm:text-[13px] font-medium text-ink truncate">
                  {user.displayName || '사용자'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${syncColor}`} />
                  <span className="font-mono text-[9px] text-dim">{syncLabel}</span>
                </span>
              </span>
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 sm:ml-[var(--sidebar-w)] px-5 pt-4 pb-[calc(76px+env(safe-area-inset-bottom))] sm:pt-20 sm:pb-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="sm:hidden mb-3 font-mono text-[15px] font-bold tracking-[-0.02em] text-[var(--logo)]">
            Booklog
          </div>
          {children}
        </div>
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-[80] grid grid-cols-5 bg-surface border-t border-border pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {MOBILE_NAV.map(({ id, label, Icon }) => {
          const active = tab === id || (id === 'more' && tab === 'friends')
          return (
            <button
              key={id}
              onClick={() => changeTab(id)}
              className={`flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer ${active ? 'text-accent' : 'text-dim'}`}
            >
              <Icon size={20} />
              <span className="inline-flex items-center gap-1">
                <span className="text-[10px]">{label}</span>
                {id === 'more' && incomingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
