import { useEffect, useRef, useState } from 'react'
import type { FriendRequest } from '../types'
import { useAppUI } from '../contexts/AppUIContext'
import { IconBell } from './layout/icons'
import {
  friendRequestNotifications,
  sortNotifications,
  countUnread,
  readSeenAt,
  markSeenNow,
} from '../lib/notifications'

interface Props {
  /** 받은 친구 요청. 지금은 알림원이 이것뿐이고, 2단계부터 좋아요·댓글이 더해진다. */
  incoming: FriendRequest[]
}

export default function NotificationBell({ incoming }: Props) {
  const { changeTab } = useAppUI()
  const [open, setOpen] = useState(false)
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeenAt())

  // 소스가 늘면 여기서 합친다. 목록 자체는 어디서 왔는지 모른다.
  const items = sortNotifications(friendRequestNotifications(incoming))
  const unread = countUnread(items, seenAt)

  // 모달과 같은 규칙 — 열려 있는 동안 Escape로 닫힌다.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 여는 순간 읽음 처리한다. 항목마다 읽음을 다루는 건 과하다.
  const panelRef = useRef<HTMLDivElement>(null)
  const toggle = () => {
    setOpen((v) => {
      if (!v) setSeenAt(markSeenNow())
      return !v
    })
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `알림 ${unread}개` : '알림'}
        className="relative w-7 h-7 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-dim hover:text-ink"
      >
        <IconBell size={18} />
        {/* 숫자 대신 점 — 숫자는 미확인 건수 압박을 주어 독서 앱 성격과 맞지 않는다 */}
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-[7px] h-[7px] rounded-full bg-accent border border-surface" />
        )}
      </button>

      {open && (
        <>
          {/* 바깥을 눌러 닫는다. 프로필 사진 메뉴와 같은 방식 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="menu"
            className="absolute right-0 top-full mt-1.5 z-50 w-[min(80vw,260px)] bg-surface border border-border rounded-xl shadow-card overflow-hidden"
          >
            {items.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs sm:text-[13px] text-dim">새로운 알림이 없어요</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    changeTab(n.goTo)
                  }}
                  className="w-full px-4 py-3 text-left text-[13px] text-ink bg-transparent border-0 border-b border-border last:border-b-0 cursor-pointer hover:bg-surface2"
                >
                  {n.text}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
