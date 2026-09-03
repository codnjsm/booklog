import { useEffect, useRef } from 'react'
import type { User } from 'firebase/auth'
import type { SyncStatus } from '../hooks/useData'

interface Props { user: User; syncStatus: SyncStatus; onSignOut: () => void; onClose: () => void }

export default function UserMenu({ user, syncStatus, onSignOut, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  const syncLabel = syncStatus === 'saving' ? '⏳ 저장 중…' : syncStatus === 'error' ? '⚠️ 저장 실패' : '☁️ 동기화됨'
  const syncColor = syncStatus === 'saving' ? 'text-accent' : syncStatus === 'error' ? 'text-danger' : 'text-ok'
  return (
    <div className="fixed bottom-[68px] right-3.5 sm:bottom-[84px] sm:right-6 bg-surface border border-border rounded-[10px] p-1 w-[210px] sm:w-[240px] shadow-card z-[91]" ref={ref}>
      <div className="px-4 pt-3.5 pb-3 border-b border-border">
        <div className="text-sm font-semibold text-ink mb-0.5">{user.displayName || '사용자'}</div>
        <div className="text-xs text-dim overflow-hidden text-ellipsis whitespace-nowrap">{user.email || ''}</div>
      </div>
      <div className={`px-4 py-2.5 text-xs border-b border-border ${syncColor}`}>{syncLabel}</div>
      <button className="w-full bg-transparent border-none text-left px-4 py-2.5 text-[13px] text-ink cursor-pointer font-sans rounded-md hover:bg-surface2" onClick={onSignOut}>로그아웃</button>
    </div>
  )
}
