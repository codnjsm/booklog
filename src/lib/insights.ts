import type { AppState, Book } from '../types'

/** 이번 주 월요일 0시 */
export function startOfWeek(now = new Date()): Date {
  const d = new Date(now)
  d.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

export function isThisWeek(iso: string, now = new Date()): boolean {
  return new Date(iso) >= startOfWeek(now)
}

/** 읽기 시작한 날. 과거 데이터에는 startedAt이 없을 수 있어 createdAt으로 폴백한다. */
export function readingSince(book: Book): string {
  return book.startedAt ?? book.createdAt
}

export function daysSince(iso: string, now = new Date()): number {
  const start = new Date(iso)
  start.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000) + 1)
}

/** 기록을 남긴 날(책 추가·완독, 문장·단어 저장)의 날짜 집합 */
function recordedDays(state: AppState): Set<string> {
  const days = new Set<string>()
  const add = (iso?: string) => { if (iso) days.add(iso.slice(0, 10)) }
  state.books.forEach((b) => { add(b.createdAt); add(b.finishedAt) })
  state.quotes.forEach((q) => add(q.createdAt))
  state.words.forEach((w) => add(w.createdAt))
  return days
}

export function recordedDaysThisWeek(state: AppState, now = new Date()): number {
  const from = startOfWeek(now)
  return [...recordedDays(state)].filter((d) => new Date(d + 'T12:00:00') >= from).length
}

export type GoalPace =
  | { state: 'none' }
  | { state: 'insufficient'; remaining: number }
  | { state: 'onTrack'; diff: number; finishMonth: number }
  | { state: 'behind'; remaining: number; monthsLeft: number }

/**
 * 목표 페이스. 표본이 적으면 추정하지 않는다 —
 * 완독 3권 미만이거나 연초 30일 미만이면 진행률만 보여준다.
 */
export function goalPace(doneThisYear: number, goal: number | undefined, now = new Date()): GoalPace {
  if (!goal || goal <= 0) return { state: 'none' }

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const elapsedDays = Math.max(1, Math.round((now.getTime() - yearStart.getTime()) / 86400000))
  const remaining = Math.max(0, goal - doneThisYear)

  if (doneThisYear < 3 || elapsedDays < 30) return { state: 'insufficient', remaining }

  const perDay = doneThisYear / elapsedDays
  const daysNeeded = remaining / perDay
  const finish = new Date(now.getTime() + daysNeeded * 86400000)
  const expectedByNow = (goal / 365) * elapsedDays
  const diff = Math.round(doneThisYear - expectedByNow)

  if (finish.getFullYear() > now.getFullYear()) {
    const monthsLeft = Math.max(1, 12 - now.getMonth())
    return { state: 'behind', remaining, monthsLeft }
  }
  return { state: 'onTrack', diff, finishMonth: finish.getMonth() + 1 }
}

export type ActivityKind = 'finished' | 'quote' | 'book' | 'word'
export interface ActivityItem {
  kind: ActivityKind
  at: string
  title: string
  sub?: string
  rating?: number
}

/** 기존 데이터(createdAt·finishedAt)에서 파생하는 활동 피드 */
export function recentActivity(state: AppState, limit = 5): ActivityItem[] {
  const items: ActivityItem[] = []

  state.books.forEach((b) => {
    if (b.finishedAt) items.push({ kind: 'finished', at: b.finishedAt, title: b.title, sub: b.author || undefined, rating: b.rating })
    items.push({ kind: 'book', at: b.createdAt, title: b.title, sub: b.author || undefined })
  })

  const byDayBook = new Map<string, { at: string; count: number; title: string }>()
  state.quotes.forEach((q) => {
    const key = q.createdAt.slice(0, 10) + '|' + (q.bookId ?? '')
    const book = state.books.find((b) => b.id === q.bookId)
    const cur = byDayBook.get(key)
    if (cur) { cur.count += 1; if (q.createdAt > cur.at) cur.at = q.createdAt }
    else byDayBook.set(key, { at: q.createdAt, count: 1, title: book?.title ?? '출처 미상' })
  })
  byDayBook.forEach(({ at, count, title }) => {
    items.push({ kind: 'quote', at, title: count > 1 ? `문장 ${count}개 저장` : '문장 저장', sub: title })
  })

  const wordsByDay = new Map<string, { at: string; count: number; term: string }>()
  state.words.forEach((w) => {
    const key = w.createdAt.slice(0, 10)
    const cur = wordsByDay.get(key)
    if (cur) { cur.count += 1; if (w.createdAt > cur.at) cur.at = w.createdAt }
    else wordsByDay.set(key, { at: w.createdAt, count: 1, term: w.term })
  })
  wordsByDay.forEach(({ at, count, term }) => {
    items.push({ kind: 'word', at, title: count > 1 ? `단어 ${count}개 저장` : `단어 저장`, sub: count > 1 ? `${term} 외 ${count - 1}개` : term })
  })

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  if (days < 28) return `${Math.floor(days / 7)}주 전`
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
