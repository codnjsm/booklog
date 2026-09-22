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

/** 책·문장·단어를 합친 개수. "기록 N개"라고 사용자에게 보여줄 때 쓴다. */
function countRecords(s: AppState): number {
  return s.books.length + s.quotes.length + (s.words?.length ?? 0)
}

function hasRecords(s: AppState): boolean {
  return countRecords(s) > 0
}

/**
 * 계정 기록과 이 브라우저 기록을 합친다. 같은 id는 계정 것을 남기고 이 브라우저에만 있던 항목을 뒤에 붙인다.
 * id는 기기마다 따로 만들어지므로 실제로 겹칠 일은 거의 없다.
 */
function mergeStates(cloud: AppState, local: AppState): AppState {
  const unionById = <T extends { id: string }>(base: T[], extra: T[]): T[] => {
    const ids = new Set(base.map((x) => x.id))
    return [...base, ...extra.filter((x) => !ids.has(x.id))]
  }
  return {
    books: unionById(cloud.books, local.books),
    quotes: unionById(cloud.quotes, local.quotes),
    words: unionById(cloud.words ?? [], local.words ?? []),
    readingGoal: cloud.readingGoal ?? local.readingGoal,
  }
}

/** 회원 탈퇴처럼 이 브라우저의 기록을 완전히 지울 때 쓴다. 호출한 쪽에서 새로고침해야 메모리 상태가 다시 저장되지 않는다. */
export function clearLocalData() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(OWNER_KEY)
  localStorage.removeItem(OWNER_MIGRATED_KEY)
}

export type SyncStatus = 'synced' | 'saving' | 'error'

export function useData(user: User | null) {
  const [state, setStateRaw] = useState<AppState>(getInitialState)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cloudLoadedRef = useRef(false)
  // 로그인 상태에서 로그아웃한 경우에만 화면을 비운다 — 처음부터 게스트였던 방문자는 그대로 둔다.
  const wasLoggedInRef = useRef(false)
  // 마지막으로 클라우드에 안전하게 반영된 걸로 확인된 기록 수. 로컬 저장소가 어떤 이유로든
  // 리셋된 채로 저장이 실행되면, 이 값과 비교해 갑자기 크게 줄었는지 감지한다.
  const lastSyncedCountRef = useRef<number | null>(null)

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
      // 로그아웃 직후에만 비운다. 클라우드 데이터는 그대로 남아 있으니 다시 로그인하면 복원된다 —
      // 안 비우면 로그아웃해도 방금 보던 계정의 책·문장이 화면에 그대로 남아, 기기를 같이 쓰는
      // 사람에게 노출된다.
      if (wasLoggedInRef.current) {
        const empty: AppState = { books: [], quotes: [], words: [] }
        setStateRaw(empty)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(empty))
        setLocalOwnerUid(null)
      }
      wasLoggedInRef.current = false
      return
    }
    wasLoggedInRef.current = true
    if (cloudLoadedRef.current) return
    cloudLoadedRef.current = true

    // 로컬 캐시가 지금 로그인한 사람 것이 아니면 아무리 최신이어도 신뢰하지 않는다
    // — 다른 사람 데이터를 이 계정에 올리지 않는다.
    const localOwner = getLocalOwnerUid()
    const localIsForeign = localOwner !== null && localOwner !== user.uid
    // 같은 계정으로 오프라인에서 고친 것 / 로그인 없이 쌓아둔 것은 성격이 달라서 따로 다룬다.
    const localIsSameAccount = localOwner === user.uid
    const localIsGuest = localOwner === null

    loadUserData(user.uid)
      .then((cloud) => {
        // 어느 분기로 가든 이 로컬 캐시의 주인은 지금 로그인한 사람이다.
        // 분기 안에서 찍으면 "로컬이 더 최신이라 그냥 return"하는 경로에서 빠져,
        // 다음 계정이 로그인할 때 남의 데이터를 걸러내지 못한다.
        setLocalOwnerUid(user.uid)

        if (cloud?.books) {
          const local = getInitialState()
          const cloudState: AppState = { ...cloud, words: cloud.words ?? [] }

          // 같은 계정으로 오프라인에서 고친 게 더 최신이면 클라우드로 덮어쓰지 않는다.
          // 게스트 기록에는 이 보호를 적용하지 않는다 — 그건 이 계정의 오프라인 편집분이 아니라서,
          // 그대로 두면 다음 저장 때 계정에 있던 기록을 통째로 밀어낸다.
          if (localIsSameAccount && local.updatedAt && cloud.updatedAt && local.updatedAt > cloud.updatedAt) {
            lastSyncedCountRef.current = countRecords(local)
            return
          }

          // 로그인 없이 쌓아둔 기록과 계정 기록이 둘 다 있으면 한쪽을 임의로 고르지 않고 물어본다.
          // 자동으로 고르면 어느 쪽이든 한쪽이 통째로 사라진다.
          if (localIsGuest && hasRecords(local) && hasRecords(cloudState)) {
            const keepBoth = confirm(
              `이 브라우저에 로그인 없이 쌓은 기록이 ${countRecords(local)}개 있어요.\n` +
                `계정에는 이미 기록이 ${countRecords(cloudState)}개 있습니다.\n\n` +
                `확인 — 두 기록을 합칩니다\n` +
                `취소 — 계정 기록만 사용합니다 (이 브라우저 기록은 사라져요)`,
            )
            const next = stripLegacySeed(keepBoth ? mergeStates(cloudState, local) : cloudState)
            setStateRaw(next)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            lastSyncedCountRef.current = countRecords(next)
            if (keepBoth || next !== cloudState) saveUserData(user.uid, JSON.parse(JSON.stringify(next)))
            return
          }

          const merged = stripLegacySeed(cloudState)
          setStateRaw(merged)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          lastSyncedCountRef.current = countRecords(merged)
          // 클라우드에 남아 있던 데모 데이터도 같이 걷어낸다
          if (merged !== cloudState) saveUserData(user.uid, JSON.parse(JSON.stringify(merged)))
        } else if (localIsForeign) {
          // 신규 가입이라 클라우드는 비어있는데, 로컬은 다른 계정이 쓰던 캐시다 — 올리지 않고 비운다.
          const empty: AppState = { books: [], quotes: [], words: [] }
          setStateRaw(empty)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(empty))
          lastSyncedCountRef.current = 0
        } else {
          // 계정이 비어 있으면 이 브라우저에 쌓아둔 기록을 그대로 올린다(단어만 있어도 올린다).
          const local = getInitialState()
          lastSyncedCountRef.current = countRecords(local)
          if (hasRecords(local)) {
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
        // 로컬 저장소가 어떤 이유로든 리셋된 채로 저장이 실행되면, 그 순간의 (줄어든) 상태가
        // 클라우드에 있던 기록을 통째로 덮어쓴다. 마지막으로 확인된 기록 수의 절반 밑으로
        // 갑자기 떨어지면 실수일 가능성이 높다고 보고 한 번 확인한다.
        const baseline = lastSyncedCountRef.current
        const nextCount = countRecords(clean)
        if (baseline !== null && baseline > 0 && nextCount < baseline / 2) {
          const proceed = confirm(
            `클라우드에 저장돼 있던 기록은 ${baseline}개인데, 지금 저장하려는 건 ${nextCount}개예요.\n` +
              `기록이 갑자기 많이 줄어든 것 같아 확인차 여쭤봅니다.\n\n` +
              `확인 — 그래도 이대로 저장합니다\n` +
              `취소 — 저장하지 않습니다 (새로고침해서 다시 확인해보세요)`,
          )
          if (!proceed) {
            setSyncStatus('error')
            return
          }
        }
        try {
          await saveUserData(user.uid, clean)
          lastSyncedCountRef.current = nextCount
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
