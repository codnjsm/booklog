import type { User } from 'firebase/auth'
import type { SyncStatus } from '../hooks/useData'
import { useAppUI } from '../contexts/AppUIContext'
import PageHeader from './layout/PageHeader'
import { IconFriends, IconExport, IconSun, IconMoon, IconSignOut, IconChevronRight } from './layout/icons'

interface Props {
  user: User | null
  syncStatus: SyncStatus
  incomingCount: number
  onExport: () => void
  onSignOut: () => void
  onSignIn: () => void
}

const ROW =
  'w-full flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl text-left cursor-pointer'

export default function MoreTab({ user, syncStatus, incomingCount, onExport, onSignOut, onSignIn }: Props) {
  const { changeTab, theme, toggleTheme } = useAppUI()

  const syncLabel = syncStatus === 'saving' ? '저장 중…' : syncStatus === 'error' ? '저장 실패' : '동기화됨'
  const syncColor = syncStatus === 'saving' ? 'bg-accent' : syncStatus === 'error' ? 'bg-danger' : 'bg-ok'

  return (
    <div>
      <PageHeader title="더보기" />

      <div className="flex flex-col gap-3">
        {user ? (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                referrerPolicy="no-referrer"
                alt=""
                className="w-11 h-11 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <span className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center text-[17px] font-semibold flex-shrink-0">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </span>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="text-[15px] font-semibold">{user.displayName || '사용자'}</div>
              <div className="text-xs sm:text-[13px] text-dim truncate">{user.email}</div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface2 flex-shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${syncColor}`} />
              <span className="font-mono text-[10px] text-dim">{syncLabel}</span>
            </div>
          </div>
        ) : (
          <button className={ROW} onClick={onSignIn}>
            <span className="w-11 h-11 rounded-full bg-surface2 text-dim flex items-center justify-center flex-shrink-0">
              <IconFriends size={20} />
            </span>
            <span className="flex-1 flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-ink">로그인</span>
              <span className="text-xs sm:text-[13px] text-dim">여러 기기에서 동기화하려면 로그인이 필요해요</span>
            </span>
            <IconChevronRight />
          </button>
        )}

        <div className="flex flex-col gap-2">
          <button className={ROW} onClick={() => changeTab('friends')}>
            <span className="text-dim">
              <IconFriends size={19} />
            </span>
            <span className="text-sm text-ink">친구</span>
            {incomingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-danger text-white text-[10px] font-bold">
                {incomingCount > 99 ? '99+' : incomingCount}
              </span>
            )}
            <span className="flex-1" />
            <span className="text-dim">
              <IconChevronRight />
            </span>
          </button>

          <button className={ROW} onClick={onExport}>
            <span className="text-dim">
              <IconExport size={19} />
            </span>
            <span className="text-sm text-ink">기록 내보내기</span>
            <span className="flex-1" />
            <span className="font-mono text-[10px] text-dim">.txt</span>
          </button>

          <div className={ROW.replace('cursor-pointer', '')}>
            <span className="text-dim">{theme === 'light' ? <IconSun size={19} /> : <IconMoon size={19} />}</span>
            <span className="text-sm text-ink">테마</span>
            <span className="flex-1" />
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface2 border border-border">
              <button
                onClick={() => {
                  if (theme !== 'light') toggleTheme()
                }}
                className={`px-3 py-1 rounded-md text-[13px] sm:text-sm border-none cursor-pointer ${theme === 'light' ? 'bg-surface text-ink font-medium' : 'bg-transparent text-dim'}`}
              >
                라이트
              </button>
              <button
                onClick={() => {
                  if (theme !== 'dark') toggleTheme()
                }}
                className={`px-3 py-1 rounded-md text-[13px] sm:text-sm border-none cursor-pointer ${theme === 'dark' ? 'bg-surface text-ink font-medium' : 'bg-transparent text-dim'}`}
              >
                다크
              </button>
            </div>
          </div>

          {user && (
            <button className={ROW} onClick={onSignOut}>
              <span className="text-dim">
                <IconSignOut size={19} />
              </span>
              <span className="text-sm text-ink">로그아웃</span>
            </button>
          )}
        </div>

        <div className="px-1 pt-1 flex flex-col gap-1">
          <div className="font-mono text-[10px] text-dim opacity-70">Booklog</div>
          {user && (
            <div className="text-xs sm:text-[13px] text-dim opacity-70 leading-relaxed">
              로그아웃해도 이 계정의 기록은 남아 있어요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
