import { describe, it, expect, vi } from 'vitest'

// useData는 firebase.ts를 끌어오는데, 그 모듈은 불러오는 것만으로 App Check(reCAPTCHA)를
// 초기화해서 브라우저가 아니면 터진다. 여기서 보려는 건 순수한 병합 로직뿐이라 통째로 막는다.
vi.mock('../firebase', () => ({ loadUserData: vi.fn(), saveUserData: vi.fn() }))
import type { AppState, Book, Quote, Word } from '../types'
import { mergeStates, stripLegacySeed, countRecords, isSuspiciousDrop, planInitialSync } from './useData'

const book = (id: string, extra: Partial<Book> = {}): Book => ({
  id,
  title: id,
  author: '저자',
  cover: '',
  year: '2020',
  status: 'done',
  rating: 0,
  review: '',
  createdAt: '2026-01-01',
  ...extra,
})
const quote = (id: string, extra: Partial<Quote> = {}): Quote => ({
  id,
  bookId: null,
  text: id,
  page: '',
  tags: [],
  note: '',
  createdAt: '2026-01-01',
  ...extra,
})
const word = (id: string): Word => ({ id, term: id, meaning: '뜻', createdAt: '2026-01-01' })
const state = (p: Partial<AppState> = {}): AppState => ({ books: [], quotes: [], words: [], ...p })

describe('mergeStates — 계정 기록과 이 브라우저 기록 합치기', () => {
  it('양쪽에만 있는 항목이 모두 남는다', () => {
    const merged = mergeStates(state({ books: [book('c1')] }), state({ books: [book('l1')] }))
    expect(merged.books.map((b) => b.id)).toEqual(['c1', 'l1'])
  })

  it('id가 겹치면 계정(클라우드) 것을 남긴다', () => {
    const merged = mergeStates(
      state({ books: [book('same', { title: '계정' })] }),
      state({ books: [book('same', { title: '로컬' })] }),
    )
    expect(merged.books).toHaveLength(1)
    expect(merged.books[0].title).toBe('계정')
  })

  it('어느 쪽도 사라지지 않는다 — 합친 개수가 줄지 않는다', () => {
    const cloud = state({ books: [book('c1')], quotes: [quote('cq')], words: [word('cw')] })
    const local = state({ books: [book('l1')], quotes: [quote('lq')], words: [word('lw')] })
    expect(countRecords(mergeStates(cloud, local))).toBe(6)
  })

  it('words가 없는 과거 데이터도 터지지 않는다', () => {
    const old = { books: [], quotes: [] } as unknown as AppState
    expect(() => mergeStates(old, old)).not.toThrow()
    expect(mergeStates(old, state({ words: [word('w')] })).words).toHaveLength(1)
  })

  it('목표는 계정 값이 우선이고, 없으면 이 브라우저 값을 쓴다', () => {
    expect(mergeStates(state({ readingGoal: 10 }), state({ readingGoal: 20 })).readingGoal).toBe(10)
    expect(mergeStates(state(), state({ readingGoal: 20 })).readingGoal).toBe(20)
  })

  it('목표 0은 "값 없음"이 아니라 0으로 지켜진다', () => {
    expect(mergeStates(state({ readingGoal: 0 }), state({ readingGoal: 20 })).readingGoal).toBe(0)
  })
})

describe('stripLegacySeed — 예전 데모 데이터만 걷어내기', () => {
  const SEED_TEXT = '당신은 목표 수준으로 떨어지는 것이 아니라, 시스템 수준으로 떨어진다.'
  const SEED_BOOK = { title: '아주 작은 습관의 힘', author: '제임스 클리어' }

  it('시드 문장과 그 책을 함께 지운다', () => {
    const b = book('b1', SEED_BOOK)
    const next = stripLegacySeed(
      state({ books: [b], quotes: [quote('q1', { bookId: 'b1', text: SEED_TEXT, tags: ['습관'] })] }),
    )
    expect(next.books).toHaveLength(0)
    expect(next.quotes).toHaveLength(0)
  })

  it('사용자가 직접 담은 같은 문장은 남긴다 (tags가 비어 있으면 시드가 아니다)', () => {
    const mine = quote('q1', { text: SEED_TEXT, tags: [] })
    expect(stripLegacySeed(state({ quotes: [mine] })).quotes).toEqual([mine])
  })

  it('제목·저자가 다르면 책을 지우지 않는다', () => {
    const other = book('b1', { title: '다른 책', author: '다른 저자' })
    const next = stripLegacySeed(
      state({ books: [other], quotes: [quote('q1', { bookId: 'b1', text: SEED_TEXT, tags: ['t'] })] }),
    )
    expect(next.books).toEqual([other])
  })

  it('지울 게 없으면 받은 객체를 그대로 돌려준다', () => {
    const s = state({ books: [book('b1')] })
    expect(stripLegacySeed(s)).toBe(s)
  })
})

describe('countRecords — 사용자에게 보여줄 기록 수', () => {
  it('책·문장·단어를 모두 센다', () => {
    expect(countRecords(state({ books: [book('b')], quotes: [quote('q')], words: [word('w')] }))).toBe(3)
  })

  it('words가 없는 과거 데이터는 0으로 센다', () => {
    expect(countRecords({ books: [book('b')], quotes: [] } as unknown as AppState)).toBe(1)
  })
})

describe('isSuspiciousDrop — 기록이 갑자기 줄었는지', () => {
  it('절반 밑으로 떨어지면 확인한다', () => {
    expect(isSuspiciousDrop(100, 40)).toBe(true)
  })

  it('절반 이상 남아 있으면 확인하지 않는다', () => {
    expect(isSuspiciousDrop(100, 60)).toBe(false)
  })

  it('정확히 절반은 통과시킨다 — 경계에서까지 막으면 정상적인 정리도 걸린다', () => {
    expect(isSuspiciousDrop(100, 50)).toBe(false)
  })

  it('아직 클라우드와 맞춰본 적이 없으면 비교하지 않는다', () => {
    expect(isSuspiciousDrop(null, 0)).toBe(false)
  })

  it('빈 계정이면 줄어들 것이 없다', () => {
    expect(isSuspiciousDrop(0, 0)).toBe(false)
  })

  it('전부 사라진 경우를 잡는다 — 실제로 데이터를 잃었던 상황', () => {
    expect(isSuspiciousDrop(37, 0)).toBe(true)
  })

  it('기록이 늘어난 것은 막지 않는다', () => {
    expect(isSuspiciousDrop(10, 100)).toBe(false)
  })
})

describe('planInitialSync — 로그인 직후 무엇을 쓸지', () => {
  const ME = 'uid-me'
  const OTHER = 'uid-other'
  const withRecords = (p: Partial<AppState> = {}) => state({ books: [book('b')], ...p })

  it('A로 쓰던 캐시가 남은 채 B로 로그인하면 그 캐시를 올리지 않고 버린다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: OTHER, local: withRecords(), cloud: null })
    expect(plan.kind).toBe('discardForeign')
  })

  it('남의 캐시여도 계정에 기록이 있으면 계정 것을 쓴다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: OTHER, local: withRecords(), cloud: withRecords() })
    expect(plan.kind).toBe('useCloud')
  })

  it('같은 계정이고 로컬이 더 최신이면 클라우드로 덮지 않는다', () => {
    const plan = planInitialSync({
      uid: ME,
      localOwner: ME,
      local: withRecords({ updatedAt: '2026-10-08T00:00:00Z' }),
      cloud: withRecords({ updatedAt: '2026-10-01T00:00:00Z' }),
    })
    expect(plan.kind).toBe('keepLocal')
  })

  it('같은 계정이어도 클라우드가 더 최신이면 클라우드를 쓴다', () => {
    const plan = planInitialSync({
      uid: ME,
      localOwner: ME,
      local: withRecords({ updatedAt: '2026-10-01T00:00:00Z' }),
      cloud: withRecords({ updatedAt: '2026-10-08T00:00:00Z' }),
    })
    expect(plan.kind).toBe('useCloud')
  })

  it('게스트 기록과 계정 기록이 둘 다 있으면 임의로 고르지 않고 묻는다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: null, local: withRecords(), cloud: withRecords() })
    expect(plan.kind).toBe('askMerge')
  })

  it('게스트 기록이 비어 있으면 묻지 않고 계정 것을 쓴다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: null, local: state(), cloud: withRecords() })
    expect(plan.kind).toBe('useCloud')
  })

  it('게스트 보호는 같은 계정에 적용하지 않는다 — 적용하면 계정 기록이 밀려난다', () => {
    // 로컬이 더 최신이지만 소유자가 게스트(null)이므로 keepLocal이 아니어야 한다
    const plan = planInitialSync({
      uid: ME,
      localOwner: null,
      local: withRecords({ updatedAt: '2026-10-08T00:00:00Z' }),
      cloud: withRecords({ updatedAt: '2026-10-01T00:00:00Z' }),
    })
    expect(plan.kind).toBe('askMerge')
  })

  it('계정이 비어 있고 로컬이 내 것이면 그대로 올린다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: ME, local: withRecords(), cloud: null })
    expect(plan.kind).toBe('uploadLocal')
  })

  it('계정이 비어 있고 게스트 기록만 있으면 그대로 올린다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: null, local: withRecords(), cloud: null })
    expect(plan.kind).toBe('uploadLocal')
  })

  it('양쪽 다 비어 있어도 터지지 않는다', () => {
    const plan = planInitialSync({ uid: ME, localOwner: null, local: state(), cloud: null })
    expect(plan.kind).toBe('uploadLocal')
  })
})
