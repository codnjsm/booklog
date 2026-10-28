import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// useChallenges는 firebase.ts를 끌어오는데, 그 모듈은 불러오는 것만으로 App Check(reCAPTCHA)를
// 초기화해서 브라우저가 아니면 터진다. 여기서 보려는 건 캐시 읽기·쓰기뿐이라 통째로 막는다.
vi.mock('../firebase', () => ({ listChallenges: vi.fn() }))
import { readCache, writeCache, clearChallengeCache, type ChallengeList } from './useChallenges'

const list = (goalDays: number): ChallengeList => ({
  joined: [
    {
      id: 'c1',
      ownerUid: 'u1',
      from: '2026-10-26',
      to: '2026-10-31',
      goalDays,
      ended: false,
      members: [{ uid: 'u1', displayName: '안채원', photoURL: '', days: 3, achieved: true }],
      invited: [],
    },
  ],
  invited: [],
})

describe('챌린지 로컬 캐시', () => {
  const store: Record<string, string> = {}
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('저장한 목록이 그대로 돌아온다', () => {
    writeCache('u1', 1000, list(3))
    expect(readCache('u1')?.data).toEqual(list(3))
  })

  it('받아온 시각을 저장한 값 그대로 돌려준다', () => {
    // 이 값이 틀어지면 React Query가 오래된 캐시를 신선한 것으로 보고 갱신을 건너뛴다.
    writeCache('u1', 1234, list(3))
    expect(readCache('u1')?.savedAt).toBe(1234)
  })

  it('다른 계정의 캐시는 쓰지 않는다', () => {
    // 한 브라우저를 둘이 쓸 때 앞사람 챌린지가 뒷사람 홈에 보이면 안 된다.
    writeCache('u1', 1000, list(3))
    expect(readCache('u2')).toBeUndefined()
  })

  it('나중에 저장한 것이 앞의 것을 덮는다', () => {
    writeCache('u1', 1000, list(3))
    writeCache('u1', 2000, list(5))
    expect(readCache('u1')?.data.joined[0].goalDays).toBe(5)
  })

  it('캐시가 없으면 undefined', () => {
    expect(readCache('u1')).toBeUndefined()
  })

  it('깨진 값이 들어 있어도 터지지 않는다', () => {
    store['reading-notes-challenges-v1'] = '{ 이건 JSON이 아니다'
    expect(readCache('u1')).toBeUndefined()
  })

  it('지우면 더 이상 돌아오지 않는다', () => {
    writeCache('u1', 1000, list(3))
    clearChallengeCache()
    expect(readCache('u1')).toBeUndefined()
  })

  it('저장소가 막혀 있어도 터지지 않는다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readCache('u1')).toBeUndefined()
    expect(() => writeCache('u1', 1000, list(3))).not.toThrow()
  })
})
