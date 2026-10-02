import type { Book } from '../types'

/**
 * 추천을 시작하는 최소 완독 권수. 이보다 적으면 취향을 말하기엔 표본이 너무 적다.
 * (읽는중·읽고싶음은 아직 읽은 게 아니므로 세지 않는다.)
 */
export const RECOMMEND_MIN_DONE = 5

/** 한 번에 검색할 저자 수. 저자마다 API를 한 번씩 부르므로 늘리면 그만큼 느려진다. */
const MAX_AUTHORS = 3

/** 이만큼 이상 주면 "좋아한 책"으로 본다. */
const LOVED_RATING = 4

/**
 * 제목 비교용 정규화. 같은 책이 "노르웨이의 숲"과 "노르웨이의 숲 (개정판)"처럼
 * 다르게 적히므로, 괄호 안과 공백을 걷어내고 비교한다.
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 추천의 출발점이 될 저자를 고른다.
 * 별점을 높게 준 책의 저자가 우선이고, 별점을 하나도 안 매기는 사용자를 위해
 * 그런 책이 없으면 완독한 책 전체를 최근 순으로 쓴다.
 */
export function pickAuthors(books: Book[]): string[] {
  const done = books.filter((b) => b.status === 'done')
  if (done.length < RECOMMEND_MIN_DONE) return []

  const loved = done.filter((b) => b.rating >= LOVED_RATING)
  const source = loved.length ? loved : done
  const sorted = [...source].sort(
    (a, b) => b.rating - a.rating || (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''),
  )

  const seen = new Set<string>()
  const authors: string[] = []
  for (const b of sorted) {
    // 공저는 "김영하, 정세랑"처럼 쉼표로 저장된다. 검색은 첫 저자로만 한다.
    const name = b.author.split(',')[0].trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    authors.push(name)
    if (authors.length >= MAX_AUTHORS) break
  }
  return authors
}

/** 그 저자의 책 중 사용자가 별점을 가장 높게 준 책 제목 — 추천 이유로 보여준다. */
export function reasonBookFor(books: Book[], author: string): string | undefined {
  return books
    .filter((b) => b.status === 'done' && b.author.split(',')[0].trim() === author)
    .sort((a, b) => b.rating - a.rating)[0]?.title
}
