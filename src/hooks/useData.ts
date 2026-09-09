import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from 'firebase/auth'
import type { AppState, Book, Quote, Word } from '../types'
import { loadUserData, saveUserData } from '../firebase'

const STORAGE_KEY = 'reading-notes-data-v1'
// 로컬 캐시가 지금 로그인한 사람 것인지 구분하는 꼬리표.
// 이게 없으면 "A로 로그인 -> 로그아웃 -> B로 로그인"에서 로컬에 남은 A의 데이터를
// "B가 게스트일 때 쓴 데이터"로 착각해 B의 계정에 그대로 업로드해버린다.
const OWNER_KEY = 'reading-notes-data-owner-v1'
// 로그인 전 화면을 채우는 데모용 데이터인지 구분하는 꼬리표. 실제로 손을 대기 전까지는
// "게스트가 직접 쓴 데이터"가 아니므로 로그인해도 계정에 업로드하면 안 된다.
const SEED_KEY = 'reading-notes-data-seed-v1'

function getLocalOwnerUid(): string | null {
  return localStorage.getItem(OWNER_KEY)
}
function setLocalOwnerUid(uid: string | null) {
  if (uid) localStorage.setItem(OWNER_KEY, uid)
  else localStorage.removeItem(OWNER_KEY)
}
function isLocalSeedOnly(): boolean {
  return localStorage.getItem(SEED_KEY) === '1'
}
function setLocalSeedOnly(v: boolean) {
  if (v) localStorage.setItem(SEED_KEY, '1')
  else localStorage.removeItem(SEED_KEY)
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

function makeSeedData(): AppState {
  const id1 = uid()
  const id2 = uid()
  const now = new Date().toISOString()
  return {
    books: [
      {
        id: id1,
        title: '아주 작은 습관의 힘',
        author: '제임스 클리어',
        year: '2019',
        status: 'done',
        rating: 5,
        review:
          '1%의 작은 변화가 쌓이면 결국 거대한 차이를 만든다는 메시지가 인상 깊었다. 시스템이 목표를 이긴다는 관점.',
        cover: '',
        createdAt: now,
        finishedAt: now,
      },
      {
        id: id2,
        title: '미움받을 용기',
        author: '기시미 이치로, 고가 후미타케',
        year: '2014',
        status: 'reading',
        rating: 0,
        review: '',
        cover: '',
        createdAt: now,
      },
    ],
    quotes: [
      {
        id: uid(),
        bookId: id1,
        text: '당신은 목표 수준으로 떨어지는 것이 아니라, 시스템 수준으로 떨어진다.',
        page: '47',
        tags: ['습관', '성장'],
        note: '결심보다 환경 설계가 중요하다는 걸 다시 한 번.',
        createdAt: now,
      },
      {
        id: uid(),
        bookId: id2,
        text: '인생은 누군가 정해주는 것이 아니라 스스로 선택하는 것이다.',
        page: '',
        tags: ['인생', '용기'],
        note: '',
        createdAt: now,
      },
    ],
    words: [],
  }
}

export type SyncStatus = 'synced' | 'saving' | 'error'

export function useData(user: User | null) {
  const [state, setStateRaw] = useState<AppState>(getInitialState)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cloudLoadedRef = useRef(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const seed = makeSeedData()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      setLocalSeedOnly(true)
      setStateRaw(seed)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      cloudLoadedRef.current = false
      return
    }
    if (cloudLoadedRef.current) return
    cloudLoadedRef.current = true

    // 로컬 캐시가 지금 로그인한 사람 것이 아니면(다른 계정이 쓰던 것이거나, 아직 손대지 않은
    // 시드 데이터면) 아무리 최신이어도 신뢰하지 않는다 — 다른 사람 데이터를 이 계정에 올리지 않는다.
    const localOwner = getLocalOwnerUid()
    const localIsForeign = localOwner !== null && localOwner !== user.uid
    const localIsSeed = isLocalSeedOnly()
    const localIsUntrusted = localIsForeign || localIsSeed

    loadUserData(user.uid)
      .then((cloud) => {
        if (cloud?.books) {
          const local = getInitialState()
          // Don't overwrite local data if it's newer than cloud data
          if (!localIsUntrusted && local.updatedAt && cloud.updatedAt && local.updatedAt > cloud.updatedAt) return
          const merged = { ...cloud, words: cloud.words ?? [] }
          setStateRaw(merged)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          setLocalOwnerUid(user.uid)
          setLocalSeedOnly(false)
        } else if (localIsUntrusted) {
          // 신규 가입이라 클라우드는 비어있는데, 로컬은 남의 캐시/시드 데이터다 — 올리지 않고 비운다.
          const empty: AppState = { books: [], quotes: [], words: [] }
          setStateRaw(empty)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(empty))
          setLocalOwnerUid(user.uid)
          setLocalSeedOnly(false)
        } else {
          const local = getInitialState()
          if (local.books.length > 0 || local.quotes.length > 0) {
            saveUserData(user.uid, JSON.parse(JSON.stringify(local)))
          }
          setLocalOwnerUid(user.uid)
        }
      })
      .catch(() => setSyncStatus('error'))
  }, [user])

  const persist = useCallback(
    (next: AppState) => {
      const stamped = { ...next, updatedAt: new Date().toISOString() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped))
      setLocalSeedOnly(false)
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
      update((s) => ({ ...s, quotes: [...s.quotes, quote] }))
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
