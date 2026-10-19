import { describe, it, expect } from 'vitest'
import { recordedDays, recordedDaysThisWeek } from './insights'
import type { AppState, Book } from '../types'

const book = (over: Partial<Book> = {}): Book => ({
  id: 'b1',
  title: '책',
  author: '저자',
  cover: '',
  year: '',
  status: 'reading',
  rating: 0,
  review: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
})

const state = (over: Partial<AppState> = {}): AppState => ({ books: [], quotes: [], words: [], ...over })

describe('recordedDays — 기록을 남긴 날', () => {
  it('책을 담은 날을 센다', () => {
    expect([...recordedDays(state({ books: [book()] }))]).toEqual(['2026-10-01'])
  })

  it('완독한 날도 센다', () => {
    const s = state({ books: [book({ finishedAt: '2026-10-05T10:00:00.000Z' })] })
    expect([...recordedDays(s)].sort()).toEqual(['2026-10-01', '2026-10-05'])
  })

  it('달력에 고른 읽은 날도 센다 — 매일 읽고 표시했는데 0일이면 안 된다', () => {
    const s = state({ books: [book({ readDates: ['2026-10-02', '2026-10-03'] })] })
    expect([...recordedDays(s)].sort()).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
  })

  it('문장과 단어를 저장한 날도 센다', () => {
    const s = state({
      quotes: [
        { id: 'q', bookId: null, text: 't', page: '', tags: [], note: '', createdAt: '2026-10-07T00:00:00.000Z' },
      ],
      words: [{ id: 'w', term: '말', meaning: '뜻', createdAt: '2026-10-08T00:00:00.000Z' }],
    })
    expect([...recordedDays(s)].sort()).toEqual(['2026-10-07', '2026-10-08'])
  })

  it('같은 날에 여러 번 기록해도 하루로 센다', () => {
    // 시각은 기기 시간으로 만든다 — ISO 문자열을 직접 적으면 시간대에 따라 날이 갈린다.
    const at = (h: number) => new Date(2026, 9, 1, h, 0, 0).toISOString()
    const s = state({
      books: [book({ createdAt: at(1), readDates: ['2026-10-01'], finishedAt: at(20) })],
      quotes: [{ id: 'q', bookId: null, text: 't', page: '', tags: [], note: '', createdAt: at(9) }],
    })
    expect([...recordedDays(s)]).toEqual(['2026-10-01'])
  })

  it('자정 직후 기록도 그날로 센다 — 전날로 밀리면 안 된다', () => {
    const s = state({ books: [book({ createdAt: new Date(2026, 9, 6, 0, 30, 0).toISOString() })] })
    expect([...recordedDays(s)]).toEqual(['2026-10-06'])
  })

  it('기록이 없으면 빈 집합', () => {
    expect(recordedDays(state()).size).toBe(0)
  })
})

describe('recordedDaysThisWeek — 이번 주만', () => {
  // 2026-10-19는 월요일. 주 시작이 어디든 같은 주 안의 날짜로 둔다.
  const now = new Date('2026-10-21T12:00:00.000Z')

  it('이번 주 기록만 센다', () => {
    const s = state({ books: [book({ createdAt: '2026-10-20T00:00:00.000Z' })] })
    expect(recordedDaysThisWeek(s, now)).toBe(1)
  })

  it('지난 달 기록은 세지 않는다', () => {
    const s = state({ books: [book({ createdAt: '2026-09-10T00:00:00.000Z' })] })
    expect(recordedDaysThisWeek(s, now)).toBe(0)
  })

  it('이번 주에 고른 읽은 날도 센다', () => {
    const s = state({ books: [book({ createdAt: '2026-09-01T00:00:00.000Z', readDates: ['2026-10-20'] })] })
    expect(recordedDaysThisWeek(s, now)).toBe(1)
  })
})
