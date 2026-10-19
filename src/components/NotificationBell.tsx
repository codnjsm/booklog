import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { FriendRequest } from '../types'
import { useAppUI } from '../contexts/AppUIContext'
import { IconBell } from './layout/icons'
import { relativeDay } from '../lib/insights'
import {
  friendRequestNotifications,
  serverNotifications,
  sortNotifications,
  countUnread,
  readSeenAt,
  markSeenNow,
  readDismissed,
  dismissNotification,
  withoutDismissed,
} from '../lib/notifications'
import type { ServerNotification } from '../lib/notifications'
import { subscribeNotifications, dismissNotifications } from '../firebase'
import { usePush } from '../hooks/usePush'
import { shouldOfferPush, readPromptDismissed, markPromptDismissed } from '../lib/push'

/** 바깥 틀. 알림이 몇 건이든 이 안에 담기고, 항목끼리는 선으로 나눈다. */
const PANEL = 'bg-surface border border-border rounded-xl shadow-card overflow-hidden'
/** border-none과 border-b를 같이 주면 style이 none이라 선이 안 그려진다. border-0으로 폭만 0으로 둔다. */
const ROW = 'w-full px-4 py-3 text-left bg-transparent border-0 border-b border-border last:border-b-0'
// 친구 요청의 수락·거절과 같은 규격(px-3 py-1.5, 테두리 없음).
// 「켜기」만 진한 채움이다 — 카드 배경이 accentsoft라 연한 채움으로 두면 묻힌다.
const BTN_OK =
  'bg-accentfill text-white border-none font-medium px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-all duration-150 hover:bg-accentfillhover disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_NEUTRAL =
  'bg-surface text-dim border-none font-medium px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-all duration-150 hover:text-ink'

interface Props {
  /** 받은 친구 요청. */
  incoming: FriendRequest[]
  uid: string
  /** 푸시 상태를 보려면 로그인 정보가 필요하다. */
  user: User | null
  /** 알림을 일으킨 사람 이름을 찾는 데 쓴다. 친구가 아니면 undefined. */
  nameOf: (uid: string) => string | undefined
}

export default function NotificationBell({ incoming, uid, user, nameOf }: Props) {
  const { changeTab, tab } = useAppUI()
  const [open, setOpen] = useState(false)
  const [seenAt, setSeenAt] = useState<string | null>(() => readSeenAt())
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed())
  const { state: pushState, busy: pushBusy, enable: enablePushFlow } = usePush(user)
  const [promptDismissed, setPromptDismissed] = useState(() => readPromptDismissed())
  const offerPush = shouldOfferPush(pushState, promptDismissed)

  const [fromServer, setFromServer] = useState<ServerNotification[]>([])
  useEffect(() => subscribeNotifications(uid, setFromServer), [uid])

  // 소스가 늘면 여기서 합친다. 목록 자체는 어디서 왔는지 모른다.
  const all = sortNotifications([...friendRequestNotifications(incoming), ...serverNotifications(fromServer, nameOf)])
  // 눌러서 본 알림은 치운다. 가서 처리할 것(친구 요청·받은 추천)은 그 탭에 그대로 남아 있다.
  const items = withoutDismissed(all, dismissed)
  const unread = countUnread(items, seenAt)

  // 탭을 옮기면 닫는다. 사이드바(z-70)와 하단탭(z-80)이 바깥 클릭을 받는 막(z-40)보다 위에 있어서,
  // 탭을 눌러도 막에 걸리지 않고 패널만 덩그러니 남는다.
  useEffect(() => {
    setOpen(false)
  }, [tab])

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
            // 모바일은 종이 화면 오른쪽 끝이라 왼쪽으로 펼친다.
            // 데스크톱은 종이 사이드바(220~280px) 안에 있어, 왼쪽으로 펼치면 화면 밖으로 잘린다.
            // 그래서 오른쪽으로 펼쳐 본문 위에 띄운다.
            className={`absolute top-full mt-1.5 z-50 w-[min(80vw,280px)] right-0 sm:right-auto sm:left-0 ${PANEL}`}
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
                    setDismissed(dismissNotification(n, all))
                    // 서버에도 지워달라고 한다. 실패해도 이 브라우저에서는 치워진 채로 둔다 —
                    // 친구 요청 알림처럼 서버에 문서가 없는 것도 있어서 로컬 기록은 그대로 쓴다.
                    void dismissNotifications([n.id]).catch(() => {})
                    setOpen(false)
                    changeTab(n.goTo, n.view || n.focus ? { view: n.view, focus: n.focus } : undefined)
                  }}
                  className={`${ROW} cursor-pointer hover:bg-surface2`}
                >
                  <span className="block text-[13px] text-ink">
                    <span className="font-semibold">{n.actor}</span>
                    {n.text}
                  </span>
                  {/* 피드 카드·최근 활동과 같은 형식. 오늘/어제/N일 전으로 보이다가 4주부터 날짜가 된다. */}
                  <span className="block font-mono text-[11px] text-dim mt-1">{relativeDay(n.at)}</span>
                </button>
              ))
            )}

            {/* 알림함을 여는 사람은 이미 알림을 보러 온 사람이다. 더보기까지 찾아 들어가는 사람은 없다.
                켤 수 있는 상태일 때만 보여준다 — 눌러도 안 되는 안내는 거짓말이다.
                배경을 깔아 목록과 갈라낸다. 같은 줄 모양이면 또 하나의 알림처럼 보인다. */}
            {offerPush && (
              <div className="px-4 py-3.5 bg-accentsoft flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-ink">폰으로도 받아보세요</span>
                <span className="text-xs text-dim leading-relaxed">앱을 열지 않아도 알림이 떠요</span>
                {/* 친구 요청의 수락·거절과 같은 규격(px-3 py-1.5, 연한 채움).
                    「나중에」는 거절이 아니라 미루기라 danger(빨강) 대신 중립으로 둔다. */}
                <div className="flex gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      markPromptDismissed()
                      setPromptDismissed(true)
                    }}
                    className={BTN_NEUTRAL}
                  >
                    나중에
                  </button>
                  <button type="button" onClick={() => void enablePushFlow()} disabled={pushBusy} className={BTN_OK}>
                    {pushBusy ? '켜는 중…' : '켜기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
