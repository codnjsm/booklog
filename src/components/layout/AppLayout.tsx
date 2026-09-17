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

export default function AppLayout({
  user,
  syncStatus,
  bookCount,
  collectionCount,
  incomingCount,
  onExport,
  children,
}: Props) {
  const { tab, changeTab, theme, toggleTheme, openLogin } = useAppUI()

  const counts: Partial<Record<Tab, number>> = { books: bookCount, collection: collectionCount }
  // 책 + 문장/단어. 로그인 안 한 사람에게 "지금 이 브라우저에만 있는 양"을 알리는 데 쓴다.
  const recordCount = bookCount + collectionCount
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
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
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
          {/* 더보기 탭의 테마 토글과 같은 형태 — 한 줄짜리 버튼은 눌러서 바뀌는 건지 알기 어렵다 */}
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] sm:text-sm text-dim">
            <span className="flex-shrink-0">{theme === 'light' ? <IconSun /> : <IconMoon />}</span>
            <span className="whitespace-nowrap">테마</span>
            <span className="flex-1" />
            <div className="flex flex-shrink-0 gap-0.5 p-0.5 rounded-lg bg-surface2 border border-border">
              <button
                onClick={() => {
                  if (theme !== 'light') toggleTheme()
                }}
                className={`px-2 py-0.5 rounded-md text-xs whitespace-nowrap border-none cursor-pointer ${theme === 'light' ? 'bg-surface text-ink font-medium' : 'bg-transparent text-dim'}`}
              >
                라이트
              </button>
              <button
                onClick={() => {
                  if (theme !== 'dark') toggleTheme()
                }}
                className={`px-2 py-0.5 rounded-md text-xs whitespace-nowrap border-none cursor-pointer ${theme === 'dark' ? 'bg-surface text-ink font-medium' : 'bg-transparent text-dim'}`}
              >
                다크
              </button>
            </div>
          </div>
          <button
            onClick={onExport}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] sm:text-sm text-dim bg-transparent border-none cursor-pointer text-left hover:text-ink"
          >
            <IconExport />
            <span>기록 내보내기</span>
          </button>
          {user ? (
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
          ) : (
            // 오버레이가 없어진 뒤 PC에서 로그인으로 갈 수 있는 유일한 경로 — 더보기 탭은
            // 로그인해야만 사이드바 메뉴에 잡히므로, 비로그인 상태에선 이 자리가 그 역할을 대신한다.
            <button
              onClick={() => openLogin()}
              className="flex items-center gap-2.5 p-2.5 mt-1.5 rounded-lg bg-surface2 border-none cursor-pointer text-left w-full"
            >
              <span className="w-7 h-7 rounded-full bg-surface text-dim flex items-center justify-center flex-shrink-0">
                <IconFriends size={14} />
              </span>
              <span className="flex flex-col gap-px min-w-0">
                <span className="text-xs sm:text-[13px] font-medium text-ink">로그인</span>
                {/* 기록이 있는 동안에는 계속 보이게 둔다 — 로그인 전까지 사실인 상태라
                    한 번 띄우고 마는 모달보다 여기가 맞다. 사이드바가 좁아 문구는 짧게. */}
                {recordCount > 0 && <span className="text-[10px] text-dim leading-tight">이 브라우저에만 저장됨</span>}
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
