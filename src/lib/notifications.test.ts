import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FriendRequest } from '../types'
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
} from './notifications'

const req = (id: string, extra: Partial<FriendRequest> = {}): FriendRequest => ({
  id,
  fromUid: 'from-' + id,
  toUid: 'me',
  status: 'pending',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
})
const profile = (p: { displayName?: string; email?: string }) => ({
  uid: 'u',
  email: p.email ?? '',
  displayName: p.displayName ?? '',
  photoURL: '',
})

describe('friendRequestNotifications — 받은 요청을 알림으로', () => {
  it('대기 중인 요청만 알림이 된다', () => {
    const items = friendRequestNotifications([
      req('a'),
      req('b', { status: 'accepted' }),
      req('c', { status: 'rejected' }),
    ])
    expect(items.map((i) => i.id)).toEqual(['a'])
  })

  it('요청이 없으면 빈 목록', () => {
    expect(friendRequestNotifications([])).toEqual([])
  })

  it('이름이 있으면 이름으로 부른다', () => {
    const [item] = friendRequestNotifications([req('a', { profile: profile({ displayName: '채원' }) })])
    expect(item.actor).toBe('채원')
    expect(item.text).toBe('님이 친구 요청을 보냈어요')
  })

  it('이름이 비어 있으면 이메일 앞부분을 쓴다', () => {
    const [item] = friendRequestNotifications([req('a', { profile: profile({ email: 'chae@example.com' }) })])
    expect(item.actor).toBe('chae')
  })

  it('프로필이 아직 안 붙었어도 문구가 깨지지 않는다', () => {
    const [item] = friendRequestNotifications([req('a')])
    expect(item.actor).toBe('누군가')
  })

  it('공백뿐인 이름은 이름이 없는 것으로 본다', () => {
    const [item] = friendRequestNotifications([req('a', { profile: profile({ displayName: '   ' }) })])
    expect(item.actor).toBe('누군가')
  })

  it('누르면 친구 탭으로 간다', () => {
    const [item] = friendRequestNotifications([req('a')])
    expect(item.goTo).toBe('friends')
  })
})

describe('sortNotifications — 최신순 정렬', () => {
  const at = (id: string, t: string) => ({
    id,
    kind: 'friendRequest' as const,
    at: t,
    actor: id,
    text: '님이 친구 요청을 보냈어요',
    goTo: 'friends' as const,
  })

  it('최신이 위로 온다', () => {
    const sorted = sortNotifications([
      at('old', '2026-10-01T00:00:00.000Z'),
      at('new', '2026-10-08T00:00:00.000Z'),
      at('mid', '2026-10-05T00:00:00.000Z'),
    ])
    expect(sorted.map((i) => i.id)).toEqual(['new', 'mid', 'old'])
  })

  it('원본 배열을 바꾸지 않는다', () => {
    const input = [at('a', '2026-10-01T00:00:00.000Z'), at('b', '2026-10-08T00:00:00.000Z')]
    sortNotifications(input)
    expect(input.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('시각이 비어 있어도 터지지 않는다', () => {
    const sorted = sortNotifications([at('a', ''), at('b', '2026-10-08T00:00:00.000Z')])
    expect(sorted.map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('countUnread — 읽지 않은 알림 수', () => {
  const at = (id: string, t: string) => ({
    id,
    kind: 'friendRequest' as const,
    at: t,
    actor: id,
    text: '님이 친구 요청을 보냈어요',
    goTo: 'friends' as const,
  })
  const items = [
    at('a', '2026-10-01T00:00:00.000Z'),
    at('b', '2026-10-05T00:00:00.000Z'),
    at('c', '2026-10-08T00:00:00.000Z'),
  ]

  it('한 번도 열지 않았으면 전부 읽지 않음', () => {
    expect(countUnread(items, null)).toBe(3)
  })

  it('연 시각보다 나중 알림만 센다', () => {
    expect(countUnread(items, '2026-10-05T00:00:00.000Z')).toBe(1)
  })

  it('연 시각과 같은 시각의 알림은 읽은 것으로 본다', () => {
    expect(countUnread([at('a', '2026-10-05T00:00:00.000Z')], '2026-10-05T00:00:00.000Z')).toBe(0)
  })

  it('가장 최근 알림 이후에 열었으면 0', () => {
    expect(countUnread(items, '2026-10-09T00:00:00.000Z')).toBe(0)
  })

  it('알림이 없으면 0', () => {
    expect(countUnread([], null)).toBe(0)
  })
})

describe('readSeenAt — 저장된 연 시각 읽기', () => {
  // 브라우저에 저장되는 값이라 언제든 손상될 수 있다. 앱이 멈추면 안 된다.
  const store: Record<string, string> = {}
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })

  it('저장된 적 없으면 null', () => {
    expect(readSeenAt()).toBeNull()
  })

  it('저장해둔 시각을 그대로 돌려준다', () => {
    const at = markSeenNow(new Date('2026-10-08T12:00:00.000Z'))
    expect(at).toBe('2026-10-08T12:00:00.000Z')
    expect(readSeenAt()).toBe('2026-10-08T12:00:00.000Z')
  })

  it('날짜가 아닌 값이 들어 있으면 null — 전부 읽지 않음으로 처리된다', () => {
    store['reading-notes-notifications-seen-at-v1'] = '망가진값'
    expect(readSeenAt()).toBeNull()
  })

  it('빈 문자열도 null', () => {
    store['reading-notes-notifications-seen-at-v1'] = ''
    expect(readSeenAt()).toBeNull()
  })

  it('저장소 자체가 막혀 있어도 터지지 않는다 (시크릿 모드 등)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readSeenAt()).toBeNull()
    expect(() => markSeenNow()).not.toThrow()
  })
})

describe('serverNotifications — 서버가 남긴 알림', () => {
  const raw = (id: string, actorUid: string, at: string, kind = 'like') => ({ id, actorUid, createdAt: at, kind })
  const names: Record<string, string> = { 'u-bob': '밥' }
  const nameOf = (uid: string) => names[uid]

  it('아는 사람이면 이름으로 부른다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-13T00:00:00.000Z')], nameOf)
    expect(n.actor).toBe('밥')
    expect(n.text).toBe('님이 회원님의 글을 좋아합니다')
  })

  it('모르는 사람이면 「내가 모르는 친구」 — 누른 사람 목록과 같은 표현', () => {
    const [n] = serverNotifications([raw('n1', 'u-x', '2026-10-13T00:00:00.000Z')], nameOf)
    expect(n.actor).toBe('내가 모르는 친구')
  })

  it('누르면 친구 탭으로 간다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-13T00:00:00.000Z')], nameOf)
    expect(n.goTo).toBe('friends')
  })

  it('알림이 없으면 빈 목록', () => {
    expect(serverNotifications([], nameOf)).toEqual([])
  })

  it('친구 요청 알림과 시간순으로 섞인다', () => {
    const fr = friendRequestNotifications([
      {
        id: 'r1',
        fromUid: 'u1',
        toUid: 'me',
        status: 'pending',
        createdAt: '2026-10-10T00:00:00.000Z',
      },
    ])
    const lk = serverNotifications([raw('n1', 'u-bob', '2026-10-12T00:00:00.000Z')], nameOf)
    const sorted = sortNotifications([...fr, ...lk])
    expect(sorted.map((x) => x.kind)).toEqual(['like', 'friendRequest'])
  })

  it('책을 권해오면 권유 알림이 된다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-15T00:00:00.000Z', 'recommend')], nameOf)
    expect(n.kind).toBe('recommend')
    expect(n.text).toBe('님이 책을 권했어요')
  })

  it('친구 요청이 수락되면 보낸 사람에게 알림이 된다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-19T00:00:00.000Z', 'friendAccepted')], nameOf)
    expect(n.text).toBe('님이 친구 요청을 수락했어요')
    expect(n.goTo).toBe('friends')
  })

  it('권한 책을 담으면 권한 사람에게 알림이 된다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-15T00:00:00.000Z', 'recommendAccepted')], nameOf)
    expect(n.text).toBe('님이 권한 책을 담았어요')
  })

  it('좋아요 알림은 피드로 보낸다 — 내 글이 있는 곳', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-15T00:00:00.000Z', 'like')], nameOf)
    expect(n.goTo).toBe('friends')
    expect(n.view).toBe('feed')
  })

  it('좋아요 알림은 어느 글인지까지 들고 간다', () => {
    const [n] = serverNotifications(
      [{ id: 'n1', kind: 'like', actorUid: 'u-bob', createdAt: '2026-10-15T00:00:00.000Z', postId: 'p-42' }],
      nameOf,
    )
    expect(n.focus).toBe('p-42')
  })

  it('postId가 없는 옛 좋아요 알림도 깨지지 않는다 — 글로 데려가지만 않는다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-15T00:00:00.000Z', 'like')], nameOf)
    expect(n.view).toBe('feed')
    expect(n.focus).toBeUndefined()
  })

  it('권유 알림은 친구 탭으로 보낸다 — 받은 추천이 거기 쌓인다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-15T00:00:00.000Z', 'recommend')], nameOf)
    expect(n.goTo).toBe('friends')
    expect(n.view).toBeUndefined()
  })

  it('친구 요청 알림도 친구 탭으로 보낸다', () => {
    const [n] = friendRequestNotifications([req('r1')])
    expect(n.goTo).toBe('friends')
    expect(n.view).toBeUndefined()
  })

  it('댓글 하나면 「님이 댓글을 남겼어요」', () => {
    const [n] = serverNotifications(
      [{ id: 'n1', kind: 'comment', actorUid: 'u-bob', createdAt: '2026-10-19T00:00:00.000Z', postId: 'p1', count: 1 }],
      nameOf,
    )
    expect(n.actor).toBe('밥')
    expect(n.text).toBe('님이 댓글을 남겼어요')
    expect(n.view).toBe('feed')
    expect(n.focus).toBe('p1')
  })

  it('여러 개면 「님 외 N명이」로 묶인다', () => {
    const [n] = serverNotifications(
      [{ id: 'n1', kind: 'comment', actorUid: 'u-bob', createdAt: '2026-10-19T00:00:00.000Z', postId: 'p1', count: 3 }],
      nameOf,
    )
    expect(n.text).toBe('님 외 2명이 댓글을 남겼어요')
  })

  it('수가 없는 옛 알림은 하나로 본다', () => {
    const [n] = serverNotifications(
      [{ id: 'n1', kind: 'comment', actorUid: 'u-bob', createdAt: '2026-10-19T00:00:00.000Z', postId: 'p1' }],
      nameOf,
    )
    expect(n.text).toBe('님이 댓글을 남겼어요')
  })

  it('챌린지 초대·참여는 기록 탭으로 보낸다', () => {
    const [a] = serverNotifications([raw('n1', 'u-bob', '2026-10-19T00:00:00.000Z', 'challengeInvite')], nameOf)
    expect(a.text).toBe('님이 챌린지에 초대했어요')
    expect(a.goTo).toBe('records')

    const [b] = serverNotifications([raw('n2', 'u-bob', '2026-10-19T00:00:00.000Z', 'challengeJoined')], nameOf)
    expect(b.text).toBe('님이 챌린지에 참여했어요')
    expect(b.goTo).toBe('records')
  })

  it('완주 알림은 보낸 사람이 없다 — 이름을 비워 문구만 그린다', () => {
    const [n] = serverNotifications([raw('n1', 'u-bob', '2026-10-19T00:00:00.000Z', 'challengeAchieved')], nameOf)
    expect(n.actor).toBe('')
    expect(n.text).toBe('챌린지를 완주했어요')
    expect(n.goTo).toBe('records')
  })

  it('kind가 없는 과거 알림은 좋아요로 본다', () => {
    const [n] = serverNotifications([{ id: 'n1', actorUid: 'u-bob', createdAt: '2026-10-13T00:00:00.000Z' }], nameOf)
    expect(n.kind).toBe('like')
  })

  it('안 읽은 수에 권유 알림도 섞여서 센다', () => {
    const items = sortNotifications([
      ...friendRequestNotifications([req('r1', { createdAt: '2026-10-14T00:00:00.000Z' })]),
      ...serverNotifications([raw('n1', 'u-bob', '2026-10-15T00:00:00.000Z', 'recommend')], nameOf),
    ])
    expect(countUnread(items, '2026-10-13T00:00:00.000Z')).toBe(2)
    expect(countUnread(items, '2026-10-14T12:00:00.000Z')).toBe(1)
  })

  it('모르는 종류가 섞여 와도 목록이 깨지지 않는다 — 그 항목만 빠진다', () => {
    const items = serverNotifications(
      [
        raw('n1', 'u-bob', '2026-10-13T00:00:00.000Z', '아직_모르는_종류'),
        raw('n2', 'u-bob', '2026-10-14T00:00:00.000Z', 'recommend'),
      ],
      nameOf,
    )
    expect(items.map((i) => i.id)).toEqual(['n2'])
  })
})

describe('치운 알림 — 눌러서 들어간 알림은 목록에서 빠진다', () => {
  const item = (id: string, at: string) => ({
    id,
    kind: 'like' as const,
    at,
    actor: '밥',
    text: '님이 회원님의 글을 좋아합니다',
    goTo: 'friends' as const,
  })

  // 위 읽음 시각 테스트와 같은 방식의 스텁
  const store: Record<string, string> = {}
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    })
  })

  it('치운 알림은 목록에서 빠지고 나머지는 남는다', () => {
    const a = item('n1', '2026-10-15T00:00:00.000Z')
    const b = item('n2', '2026-10-15T01:00:00.000Z')
    const next = dismissNotification(a, [a, b])
    expect(withoutDismissed([a, b], next).map((x) => x.id)).toEqual(['n2'])
  })

  it('새로고침해도 치운 채로 남는다', () => {
    const a = item('n1', '2026-10-15T00:00:00.000Z')
    dismissNotification(a, [a])
    expect(withoutDismissed([a], readDismissed())).toEqual([])
  })

  it('같은 id라도 시각이 다르면 다시 보인다 — 좋아요를 취소했다 다시 누른 경우', () => {
    const before = item('like_p1_bob', '2026-10-15T00:00:00.000Z')
    dismissNotification(before, [before])
    const again = item('like_p1_bob', '2026-10-15T09:00:00.000Z')
    expect(withoutDismissed([again], readDismissed()).map((x) => x.id)).toEqual(['like_p1_bob'])
  })

  it('이미 사라진 알림의 기록은 버려서 목록이 길어지지 않는다', () => {
    const old = item('n1', '2026-10-01T00:00:00.000Z')
    dismissNotification(old, [old])
    const fresh = item('n2', '2026-10-15T00:00:00.000Z')
    // 이제 n1은 서버에서 사라졌다 — 지금 목록에는 n2만 있다
    expect(dismissNotification(fresh, [fresh])).toEqual(['n2@2026-10-15T00:00:00.000Z'])
  })

  it('치운 알림은 안 읽은 수에서도 빠진다', () => {
    const a = item('n1', '2026-10-15T00:00:00.000Z')
    const b = item('n2', '2026-10-15T01:00:00.000Z')
    const next = dismissNotification(a, [a, b])
    expect(countUnread(withoutDismissed([a, b], next), '2026-10-14T00:00:00.000Z')).toBe(1)
  })

  it('저장소가 막혀 있어도 터지지 않는다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const a = item('n1', '2026-10-15T00:00:00.000Z')
    expect(readDismissed()).toEqual([])
    expect(() => dismissNotification(a, [a])).not.toThrow()
  })
})
