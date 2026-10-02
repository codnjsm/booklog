import { describe, it, expect, vi } from 'vitest'

// useData는 firebase.ts를 끌어오는데, 그 모듈은 불러오는 것만으로 App Check(reCAPTCHA)를
// 초기화해서 브라우저가 아니면 터진다. 여기서 보려는 건 순수한 병합 로직뿐이라 통째로 막는다.
vi.mock('../firebase', () => ({ loadUserData: vi.fn(), saveUserData: vi.fn() }))
import type { AppState, Book, Quote, Word } from '../types'
import { mergeStates, stripLegacySeed, countRecords } from './useData'

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
