import { describe, it, expect } from 'vitest'
import type { Book } from '../types'
import { pickAuthors, normalizeTitle, reasonBookFor, RECOMMEND_MIN_DONE } from './recommend'

const done = (title: string, author: string, rating = 0, finishedAt = '2026-01-01'): Book => ({
  id: title,
  title,
  author,
  cover: '',
  year: '2020',
  status: 'done',
  rating,
  review: '',
  createdAt: '2026-01-01',
  finishedAt,
})

/** 완독 5권을 채우되 저자를 다르게 해서, 표본 조건만 만족시키는 더미. */
const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => done(`더미${i}`, `더미저자${i}`, 5, `2026-01-0${i + 1}`))

describe('pickAuthors — 추천의 출발점이 될 저자 고르기', () => {
  it(`완독이 ${RECOMMEND_MIN_DONE}권 미만이면 추천하지 않는다`, () => {
    expect(pickAuthors(filler(RECOMMEND_MIN_DONE - 1))).toEqual([])
  })

  it('읽는중·읽고싶음은 완독으로 세지 않는다', () => {
    const reading = filler(5).map((b) => ({ ...b, status: 'reading' as const }))
    expect(pickAuthors(reading)).toEqual([])
  })

  it('별점을 높게 준 책의 저자만 뽑는다', () => {
    const picked = pickAuthors([
      done('a', '좋아한작가', 5),
      done('b', '그저그런작가', 3),
      done('c', '싫은작가', 1),
      ...filler(2).map((b) => ({ ...b, rating: 0 })),
    ])
    expect(picked).toContain('좋아한작가')
    expect(picked).not.toContain('그저그런작가')
    expect(picked).not.toContain('싫은작가')
  })

  it('별점을 하나도 안 매겼으면 최근 완독순으로 대체한다', () => {
    const noRating = [
      done('a', '오래전작가', 0, '2026-01-01'),
      done('b', '최근작가', 0, '2026-05-01'),
      ...filler(3).map((b) => ({ ...b, rating: 0, finishedAt: '2026-02-01' })),
    ]
    expect(pickAuthors(noRating)[0]).toBe('최근작가')
  })

  it('저자는 최대 3명까지만 (저자마다 검색을 한 번씩 하므로)', () => {
    expect(pickAuthors(filler(10)).length).toBeLessThanOrEqual(3)
  })

  it('같은 저자를 두 번 넣지 않는다', () => {
    const picked = pickAuthors([done('a', '한강', 5), done('b', '한강', 5), ...filler(3)])
    expect(new Set(picked).size).toBe(picked.length)
  })

  it('공저는 첫 저자로만 검색한다', () => {
    // 완독일을 가장 늦게 둬서 정렬 맨 앞에 오게 한다 (같은 별점이면 최근 완독이 우선).
    const picked = pickAuthors([done('a', '김초엽, 김원영', 5, '2026-12-31'), ...filler(4)])
    expect(picked[0]).toBe('김초엽')
    expect(picked).not.toContain('김원영')
  })
})

describe('normalizeTitle — 같은 책을 같은 책으로 보기', () => {
  it('판형 표기(괄호)를 무시한다', () => {
    expect(normalizeTitle('노르웨이의 숲 (개정판)')).toBe(normalizeTitle('노르웨이의숲'))
  })

  it('공백과 대소문자를 무시한다', () => {
    expect(normalizeTitle('The  Road')).toBe(normalizeTitle('theroad'))
  })

  it('다른 책은 다르게 본다', () => {
    expect(normalizeTitle('채식주의자')).not.toBe(normalizeTitle('소년이 온다'))
  })
})

describe('reasonBookFor — 추천 이유로 보여줄 책', () => {
  it('그 저자의 책 중 별점이 가장 높은 것을 고른다', () => {
    const books = [done('별로', '한강', 2), done('최고', '한강', 5), done('중간', '한강', 3)]
    expect(reasonBookFor(books, '한강')).toBe('최고')
  })

  it('읽은 적 없는 저자면 아무것도 돌려주지 않는다', () => {
    expect(reasonBookFor([done('a', '한강', 5)], '김영하')).toBeUndefined()
  })
})
