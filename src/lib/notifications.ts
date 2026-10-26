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
  kind:
    | 'friendRequest'
    | 'like'
    | 'recommend'
    | 'recommendAccepted'
    | 'friendAccepted'
    | 'challengeInvite'
    | 'challengeJoined'
    | 'challengeAchieved'
    | 'comment'
  /** ISO 문자열. 정렬과 읽음 판정에 쓴다. */
  at: string
  /** 알림을 일으킨 사람 이름. 화면에서 굵게 보여준다. 사람이 없는 알림(완주 등)은 빈 문자열. */
  actor: string
  /** 이름 뒤에 붙는 문구. 이름과 나눠둬야 이름만 굵게 그릴 수 있다. */
  text: string
  /** 눌렀을 때 갈 탭. */
  goTo: Tab
  /** 탭 안에서 더 들어가야 하는 화면. 친구 탭의 피드, 기록 탭의 챌린지. */
  view?: 'feed' | 'challenges'
  /** 그 화면에서 찾아가 보여줄 대상. 지금은 피드의 게시물 id뿐이다. */
  focus?: string
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
      actor: senderName(r),
      text: '님이 친구 요청을 보냈어요',
      goTo: 'friends' as Tab,
    }))
}

/** 서버가 알림 문서에 남기는 모양. 종류는 늘어나므로 문자열로 받는다. */
export interface ServerNotification {
  id: string
  /** 2단계(좋아요)보다 먼저 쌓인 문서에는 없을 수 있다. */
  kind?: string
  actorUid: string
  createdAt: string
  /** 좋아요·댓글 알림에 있다 — 어떤 글에 달렸는지. */
  postId?: string
  /** 묶인 알림의 개수. 댓글처럼 한 글에 여러 번 일어나는 알림에만 있다. */
  count?: number
}

/**
 * 종류별 문구와 갈 곳. 여기 없는 종류는 그릴 줄 모르는 것이므로 목록에서 뺀다.
 *
 * 좋아요는 내 글에 달린 것이므로 글이 있는 피드로 보낸다.
 * 챌린지는 기록 탭에 있다.
 *
 * `solo`는 **일으킨 사람이 없는 알림**이다. 완주는 내가 해낸 일이라 「누가」가 없다.
 */
const SERVER_KINDS: Record<
  string,
  { text: string | ((count: number) => string); goTo: Tab; view?: 'feed' | 'challenges'; solo?: true }
> = {
  like: { text: '님이 회원님의 글을 좋아합니다', goTo: 'friends', view: 'feed' },
  recommend: { text: '님이 책을 권했어요', goTo: 'friends' },
  recommendAccepted: { text: '님이 권한 책을 담았어요', goTo: 'friends' },
  friendAccepted: { text: '님이 친구 요청을 수락했어요', goTo: 'friends' },
  // 기록 탭은 달력이 세로로 길어서 챌린지가 스크롤 아래에 있다. 그 자리까지 내려준다.
  challengeInvite: { text: '님이 챌린지에 초대했어요', goTo: 'records', view: 'challenges' },
  challengeJoined: { text: '님이 챌린지에 참여했어요', goTo: 'records', view: 'challenges' },
  challengeAchieved: { text: '챌린지를 완주했어요', goTo: 'records', view: 'challenges', solo: true },
  // 한 글에 여러 명이 달면 하나로 묶인다.
  comment: {
    text: (n) => (n > 1 ? `님 외 ${n - 1}명이 댓글을 남겼어요` : '님이 댓글을 남겼어요'),
    goTo: 'friends',
    view: 'feed',
  },
}

/**
 * 서버가 남긴 알림(좋아요·책 권하기)을 항목으로 바꾼다.
 *
 * 한 사람 이름은 서버가 알림에 담지 않으므로, 아는 사람이면 친구 목록에서 찾아 쓴다.
 * 못 찾으면 「내가 모르는 친구」 — 좋아요 누른 사람 목록과 같은 표현을 쓴다.
 *
 * 모르는 종류가 섞여 와도 목록이 깨지지 않게 조용히 건너뛴다.
 * 앱을 새로 고치지 않은 사용자에게 새 종류의 알림이 닿을 수 있다.
 */
export function serverNotifications(
  items: ServerNotification[],
  nameOf: (uid: string) => string | undefined,
): NotificationItem[] {
  return items.flatMap((n) => {
    // kind가 없는 건 좋아요만 있던 시절의 알림이다.
    const kind = n.kind ?? 'like'
    const spec = SERVER_KINDS[kind]
    if (!spec) return []
    return [
      {
        id: n.id,
        kind: kind as NotificationItem['kind'],
        at: n.createdAt,
        // 일으킨 사람이 없는 알림은 이름을 비운다. 화면이 문구만 그린다.
        actor: spec.solo ? '' : nameOf(n.actorUid) || '내가 모르는 친구',
        text: typeof spec.text === 'function' ? spec.text(n.count ?? 1) : spec.text,
        goTo: spec.goTo,
        ...(spec.view ? { view: spec.view } : {}),
        // 좋아요·댓글은 어느 글에 달렸는지까지 안다. 피드에서 그 글로 데려간다.
        ...((kind === 'like' || kind === 'comment') && n.postId ? { focus: n.postId } : {}),
      },
    ]
  })
}

/** 여러 소스에서 모은 알림을 최신순으로 정렬한다. */
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
 * 눌러서 치운 알림. 읽음 시각(seenAt)과 같은 이유로 이 브라우저에만 남긴다 —
 * 알림은 되돌릴 수 없는 정보가 아니고, 애초에 클라이언트는 알림 문서를 지울 수 없다
 * (보안 규칙상 서버만 쓴다). 친구 요청 알림은 그 컬렉션에 있지도 않다.
 */
const DISMISSED_KEY = 'reading-notes-notifications-dismissed-v1'

/**
 * 치운 기록의 키. id만 쓰면 안 된다 — 좋아요 알림은 문서 id가 (게시물, 누른 사람)으로
 * 고정이라, 취소했다 다시 누르면 같은 id로 되살아난다. 시각까지 묶어야 그때는 다시 보인다.
 */
function dismissKey(item: { id: string; at: string }): string {
  return `${item.id}@${item.at}`
}

/** 저장된 값이 깨져 있으면 아무것도 안 치운 것으로 본다 — 알림이 조금 더 보일 뿐이다. */
export function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * 알림 하나를 치우고 새 기록을 돌려준다.
 * 지금 목록에 없는 알림의 기록은 같이 버린다 — 안 그러면 이 목록이 끝없이 길어진다.
 */
export function dismissNotification(
  item: NotificationItem,
  live: NotificationItem[],
  current: string[] = readDismissed(),
): string[] {
  const liveKeys = new Set(live.map(dismissKey))
  const next = [...new Set([...current.filter((k) => liveKeys.has(k)), dismissKey(item)])]
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  } catch {
    /* 저장에 실패해도 이번 화면에서는 치워진 채로 보인다 */
  }
  return next
}

/** 치운 알림을 뺀 목록. */
export function withoutDismissed(items: NotificationItem[], dismissed: string[]): NotificationItem[] {
  const gone = new Set(dismissed)
  return items.filter((i) => !gone.has(dismissKey(i)))
}

/**
 * 읽지 않은 알림 수.
 * 연 시각과 같은 시각의 알림은 읽은 것으로 본다 — 여는 순간 화면에 떠 있던 것들이다.
 */
export function countUnread(items: NotificationItem[], seenAt: string | null): number {
  if (seenAt === null) return items.length
  return items.filter((i) => i.at > seenAt).length
}
