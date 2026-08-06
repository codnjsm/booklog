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
  const syncClass = `user-menu-sync${syncStatus === 'saving' ? ' saving' : syncStatus === 'error' ? ' error' : ''}`
  return (
    <div className="user-menu" ref={ref}>
      <div className="user-menu-info">
        <div>{user.displayName || '사용자'}</div>
        <div>{user.email || ''}</div>
      </div>
      <div className={syncClass}>{syncLabel}</div>
      <button className="user-menu-btn" onClick={onSignOut}>로그아웃</button>
    </div>
  )
}
