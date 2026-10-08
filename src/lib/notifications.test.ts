import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FriendRequest } from '../types'
import { friendRequestNotifications, sortNotifications, countUnread, readSeenAt, markSeenNow } from './notifications'

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
