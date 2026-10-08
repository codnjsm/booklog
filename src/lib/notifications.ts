import type { FriendRequest } from '../types'
import type { Tab } from '../contexts/AppUIContext'

/**
 * 알림함에 한 줄로 뜨는 항목.
 *
 * 소스를 몰라야 한다 — 지금은 친구 요청뿐이지만 2단계부터 좋아요·댓글이 붙는다.
 * 그때 화면을 다시 만들지 않으려고, 목록은 이 형태만 알고 그린다.
 */
export interface NotificationItem {
  /** 같은 알림을 두 번 그리지 않기 위한 키. 소스의 문서 id를 그대로 쓴다. */
  id: string
  kind: 'friendRequest'
  /** ISO 문자열. 정렬과 읽음 판정에 쓴다. */
  at: string
  /** 목록에 보일 한 줄. */
  text: string
  /** 눌렀을 때 갈 화면. */
  goTo: Tab
}

/** 보낸 사람 이름. 프로필이 아직 안 붙었거나 이름이 비어 있으면 이메일 앞부분, 그것도 없으면 "누군가". */
function senderName(req: FriendRequest): string {
  const p = req.profile
  return p?.displayName?.trim() || p?.email?.split('@')[0] || '누군가'
}

/**
 * 받은 친구 요청을 알림 항목으로 바꾼다.
 * 이미 수락·거절한 요청은 알릴 일이 끝났으므로 뺀다.
 */
export function friendRequestNotifications(incoming: FriendRequest[]): NotificationItem[] {
  return incoming
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      id: r.id,
      kind: 'friendRequest' as const,
      at: r.createdAt,
      text: `${senderName(r)}님이 친구 요청을 보냈어요`,
      goTo: 'friends' as Tab,
    }))
}

/** 여러 소스에서 모은 알림을 최신순으로 정렬한다. 2단계에서 소스가 늘면 여기로 합친다. */
export function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
}

/**
 * 알림함을 마지막으로 연 시각. 이 브라우저에만 남긴다.
 *
 * 서버에 저장하지 않는 이유 — 알림은 되돌릴 수 없는 정보가 아니고,
 * 읽음 처리마다 서버에 쓰면 쓰기 횟수만 늘어난다. 기기마다 따로 관리돼도 괜찮다.
 */
const SEEN_AT_KEY = 'reading-notes-notifications-seen-at-v1'

/** 저장된 값이 깨져 있으면 "한 번도 안 열었다"로 본다 — 알림이 조금 더 보일 뿐 앱이 멈추지는 않는다. */
export function readSeenAt(): string | null {
  try {
    const raw = localStorage.getItem(SEEN_AT_KEY)
    if (!raw) return null
    return Number.isNaN(Date.parse(raw)) ? null : raw
  } catch {
    return null
  }
}

export function markSeenNow(now: Date = new Date()): string {
  const at = now.toISOString()
  try {
    localStorage.setItem(SEEN_AT_KEY, at)
  } catch {
    /* 저장에 실패해도 화면은 그대로 동작한다 */
  }
  return at
}

/**
 * 읽지 않은 알림 수.
 * 연 시각과 같은 시각의 알림은 읽은 것으로 본다 — 여는 순간 화면에 떠 있던 것들이다.
 */
export function countUnread(items: NotificationItem[], seenAt: string | null): number {
  if (seenAt === null) return items.length
  return items.filter((i) => i.at > seenAt).length
}
