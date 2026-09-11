import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from 'firebase/auth'
import type { AppState, Book, Quote, Word } from '../types'
import { loadUserData, saveUserData } from '../firebase'

const STORAGE_KEY = 'reading-notes-data-v1'
// 로컬 캐시가 지금 로그인한 사람 것인지 구분하는 꼬리표.
// 이게 없으면 "A로 로그인 -> 로그아웃 -> B로 로그인"에서 로컬에 남은 A의 데이터를
// "B가 게스트일 때 쓴 데이터"로 착각해 B의 계정에 그대로 업로드해버린다.
const OWNER_KEY = 'reading-notes-data-owner-v1'
const OWNER_MIGRATED_KEY = 'reading-notes-owner-migrated-v1'
/** 소유자를 알 수 없는 로컬 캐시. 어떤 uid와도 다르므로 어느 계정에도 올라가지 않는다. */
const UNKNOWN_OWNER = 'unknown'

function getLocalOwnerUid(): string | null {
  return localStorage.getItem(OWNER_KEY)
}
function setLocalOwnerUid(uid: string | null) {
  if (uid) localStorage.setItem(OWNER_KEY, uid)
  else localStorage.removeItem(OWNER_KEY)
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function getInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      return { ...parsed, words: parsed.words ?? [] }
    }
  } catch {
    /* empty */
  }
  return { books: [], quotes: [], words: [] }
}

// 2026-09-09까지 첫 방문자에게 심던 데모 데이터. 계정 전환 버그로 남의 계정에까지 올라간 적이
// 있어서, 기기나 클라우드에 남아 있으면 걷어낸다. 이제 심지 않으므로 새로 생기지는 않는다.
const LEGACY_SEED_QUOTE_TEXTS = [
  '당신은 목표 수준으로 떨어지는 것이 아니라, 시스템 수준으로 떨어진다.',
  '인생은 누군가 정해주는 것이 아니라 스스로 선택하는 것이다.',
]
const LEGACY_SEED_BOOKS = [
  { title: '아주 작은 습관의 힘', author: '제임스 클리어' },
  { title: '미움받을 용기', author: '기시미 이치로, 고가 후미타케' },
]

/**
 * 데모 데이터만 정확히 골라 걷어낸다. 지울 게 없으면 받은 객체를 그대로 돌려준다.
 * 문장은 text가 같고 tags까지 차 있을 때만 시드로 본다 — 지금 앱은 tags를 항상 빈 배열로
 * 저장하므로, 사용자가 직접 담은 같은 문장은 여기 걸리지 않는다.
 * 책은 그 시드 문장이 가리키는 것 중 제목·저자까지 맞는 것만 지운다.
 */
function stripLegacySeed(state: AppState): AppState {
  const seedQuotes = state.quotes.filter((q) => LEGACY_SEED_QUOTE_TEXTS.includes(q.text) && (q.tags?.length ?? 0) > 0)
  if (seedQuotes.length === 0) return state

  const seedQuoteIds = new Set(seedQuotes.map((q) => q.id))
  const seedBookIds = new Set(
    state.books
      .filter(
        (b) =>
          seedQuotes.some((q) => q.bookId === b.id) &&
          LEGACY_SEED_BOOKS.some((s) => s.title === b.title && s.author === b.author),
      )
      .map((b) => b.id),
  )

  return {
    ...state,
    books: state.books.filter((b) => !seedBookIds.has(b.id)),
    quotes: state.quotes.filter((q) => !seedQuoteIds.has(q.id)),
  }
}

export type SyncStatus = 'synced' | 'saving' | 'error'

export function useData(user: User | null) {
  const [state, setStateRaw] = useState<AppState>(getInitialState)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cloudLoadedRef = useRef(false)

  // 소유자 꼬리표가 생기기 전(2026-09-09 이전)에 저장된 로컬 데이터는 누구 것인지 알 수 없다.
  // 딱 한 번 unknown으로 찍어서 어느 계정에도 올라가지 않게 한다. 이후 게스트가 새로 쓴 데이터는
  // 꼬리표가 없으므로 첫 로그인 때 정상적으로 계정에 합쳐진다.
  useEffect(() => {
    if (localStorage.getItem(OWNER_MIGRATED_KEY)) return
    localStorage.setItem(OWNER_MIGRATED_KEY, '1')
    if (localStorage.getItem(STORAGE_KEY) && !getLocalOwnerUid()) setLocalOwnerUid(UNKNOWN_OWNER)
  }, [])

  // 기기에 남아 있는 데모 데이터 뒷정리. 로그인해서 클라우드를 읽기 전에 먼저 치운다.
  useEffect(() => {
    const local = getInitialState()
    const cleaned = stripLegacySeed(local)
    if (cleaned === local) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
    setStateRaw(cleaned)
  }, [])

  useEffect(() => {
    if (!user) {
      cloudLoadedRef.current = false
      return
    }
    if (cloudLoadedRef.current) return
    cloudLoadedRef.current = true

    // 로컬 캐시가 지금 로그인한 사람 것이 아니면 아무리 최신이어도 신뢰하지 않는다
    // — 다른 사람 데이터를 이 계정에 올리지 않는다.
    const localOwner = getLocalOwnerUid()
    const localIsForeign = localOwner !== null && localOwner !== user.uid

    loadUserData(user.uid)
      .then((cloud) => {
        // 어느 분기로 가든 이 로컬 캐시의 주인은 지금 로그인한 사람이다.
        // 분기 안에서 찍으면 "로컬이 더 최신이라 그냥 return"하는 경로에서 빠져,
        // 다음 계정이 로그인할 때 남의 데이터를 걸러내지 못한다.
        setLocalOwnerUid(user.uid)

        if (cloud?.books) {
          const local = getInitialState()
          // Don't overwrite local data if it's newer than cloud data
          if (!localIsForeign && local.updatedAt && cloud.updatedAt && local.updatedAt > cloud.updatedAt) return
          const cloudState: AppState = { ...cloud, words: cloud.words ?? [] }
          const merged = stripLegacySeed(cloudState)
          setStateRaw(merged)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          // 클라우드에 남아 있던 데모 데이터도 같이 걷어낸다
          if (merged !== cloudState) saveUserData(user.uid, JSON.parse(JSON.stringify(merged)))
        } else if (localIsForeign) {
          // 신규 가입이라 클라우드는 비어있는데, 로컬은 다른 계정이 쓰던 캐시다 — 올리지 않고 비운다.
          const empty: AppState = { books: [], quotes: [], words: [] }
          setStateRaw(empty)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(empty))
        } else {
          const local = getInitialState()
          if (local.books.length > 0 || local.quotes.length > 0) {
            saveUserData(user.uid, JSON.parse(JSON.stringify(local)))
          }
        }
      })
      .catch(() => setSyncStatus('error'))
  }, [user])

  const persist = useCallback(
    (next: AppState) => {
      const stamped = { ...next, updatedAt: new Date().toISOString() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped))
      if (user) setLocalOwnerUid(user.uid)
      if (!user) return
      if (timerRef.current) clearTimeout(timerRef.current)
      setSyncStatus('saving')
      // JSON round-trip strips undefined fields so Firestore doesn't reject them
      const clean: AppState = JSON.parse(JSON.stringify(stamped))
      timerRef.current = setTimeout(async () => {
        try {
          await saveUserData(user.uid, clean)
          setSyncStatus('synced')
        } catch {
          setSyncStatus('error')
        }
      }, 300)
    },
    [user],
  )

  const update = useCallback(
    (fn: (prev: AppState) => AppState) => {
      setStateRaw((prev) => {
        const next = fn(prev)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const addBook = useCallback(
    (data: Omit<Book, 'id' | 'createdAt'>) => {
      const now = new Date().toISOString()
      const book: Book = { ...data, id: uid(), createdAt: now }
      if ((data.status === 'reading' || data.status === 'done') && !book.startedAt) book.startedAt = now
      if (data.status === 'done' && !book.finishedAt) book.finishedAt = now
      update((s) => ({ ...s, books: [...s.books, book] }))
    },
    [update],
  )

  const updateBook = useCallback(
    (id: string, patch: Partial<Book>) => {
      update((s) => ({
        ...s,
        books: s.books.map((b) => {
          if (b.id !== id) return b
          const next = { ...b, ...patch }
          if ((patch.status === 'reading' || patch.status === 'done') && !next.startedAt)
            next.startedAt = new Date().toISOString()
          if (b.status !== 'done' && patch.status === 'done' && !patch.finishedAt) {
            if (b.readDates && b.readDates.length > 0) {
              const todayStr = new Date().toISOString().slice(0, 10)
              const readDates = b.readDates.includes(todayStr) ? b.readDates : [...b.readDates, todayStr].sort()
              next.readDates = readDates
              next.finishedAt = readDates[readDates.length - 1] + 'T12:00:00.000Z'
            } else {
              next.finishedAt = new Date().toISOString()
            }
          }
          return next
        }),
      }))
    },
    [update],
  )

  const deleteBook = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        books: s.books.filter((b) => b.id !== id),
        quotes: s.quotes.filter((q) => q.bookId !== id),
      }))
    },
    [update],
  )

  const addQuote = useCallback(
    (data: Omit<Quote, 'id' | 'createdAt'>) => {
      const quote: Quote = { ...data, id: uid(), createdAt: new Date().toISOString() }
      update((s) => ({
        ...s,
        quotes: [...s.quotes, quote],
        // 읽고싶음 책에 문장을 저장했다는 건 이미 읽기 시작했다는 뜻이므로 읽는중으로 옮긴다.
        books: data.bookId
          ? s.books.map((b) =>
              b.id === data.bookId && b.status === 'wishlist'
                ? { ...b, status: 'reading', startedAt: b.startedAt ?? new Date().toISOString() }
                : b,
            )
          : s.books,
      }))
    },
    [update],
  )

  const updateQuote = useCallback(
    (id: string, patch: Partial<Quote>) => {
      update((s) => ({
        ...s,
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      }))
    },
    [update],
  )

  const deleteQuote = useCallback(
    (id: string) => {
      update((s) => ({ ...s, quotes: s.quotes.filter((q) => q.id !== id) }))
    },
    [update],
  )

  const addWord = useCallback(
    (data: Omit<Word, 'id' | 'createdAt'>) => {
      const word: Word = { ...data, id: uid(), createdAt: new Date().toISOString() }
      update((s) => ({ ...s, words: [...s.words, word] }))
    },
    [update],
  )

  const deleteWord = useCallback(
    (id: string) => {
      update((s) => ({ ...s, words: s.words.filter((w) => w.id !== id) }))
    },
    [update],
  )

  const exportData = useCallback(() => {
    const fmt = (iso?: string) => (iso ? iso.slice(0, 10) : '')
    const lines: string[] = []

    const doneBooks = state.books.filter((b) => b.status === 'done')
    const readingBooks = state.books.filter((b) => b.status === 'reading')
    const wishBooks = state.books.filter((b) => b.status === 'wishlist')

    const writeBooks = (books: typeof state.books) => {
      for (const book of books) {
        lines.push(`■ ${book.title}${book.author ? `  —  ${book.author}` : ''}`)
        const start = fmt(book.startedAt)
        const end = fmt(book.finishedAt)
        if (start || end) lines.push(`  읽은 기간: ${start}${end ? ` ~ ${end}` : ' ~'}`)
        if (book.review) lines.push(`  한줄평: ${book.review}`)
        const quotes = state.quotes.filter((q) => q.bookId === book.id)
        if (quotes.length > 0) {
          lines.push(`  마음에 드는 문장:`)
          for (const q of quotes) {
            lines.push(`  · "${q.text}"${q.page ? `  (p.${q.page})` : ''}`)
            if (q.note) lines.push(`    → ${q.note}`)
          }
        }
        lines.push('')
      }
    }

    if (doneBooks.length > 0) {
      lines.push('─── 다 읽은 책 ───')
      lines.push('')
      writeBooks(doneBooks)
    }
    if (readingBooks.length > 0) {
      lines.push('─── 읽는 중 ───')
      lines.push('')
      writeBooks(readingBooks)
    }
    if (wishBooks.length > 0) {
      lines.push('─── 읽고 싶은 책 ───')
      lines.push('')
      writeBooks(wishBooks)
    }

    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reading-books-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [state])

  const setGoal = useCallback(
    (goal: number) => {
      update((s) => ({ ...s, readingGoal: goal }))
    },
    [update],
  )

  return {
    state,
    syncStatus,
    addBook,
    updateBook,
    deleteBook,
    addQuote,
    updateQuote,
    deleteQuote,
    addWord,
    deleteWord,
    exportData,
    setGoal,
  }
}
