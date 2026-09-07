import { useState } from 'react'
import type { Book, Quote, BookStatus } from '../types'
import BookCard from './BookCard'
import { useAppUI } from '../contexts/AppUIContext'
import PageHeader from './layout/PageHeader'
import { IconBooks } from './layout/icons'
import { IconSearch } from './layout/icons'

const STATUSES: { id: BookStatus | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'wishlist', label: '읽고싶음' },
  { id: 'reading', label: '읽는중' },
  { id: 'done', label: '완독' },
]

type SortKey = 'newest' | 'rating' | 'title' | 'finishedAt'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: '최근 추가순' },
  { id: 'rating', label: '별점순' },
  { id: 'title', label: '제목순' },
  { id: 'finishedAt', label: '완독일순' },
]

// 상태 칩만 눌렀는데 그 상태에 책이 없을 때 — 검색 얘기 대신 상태에 맞는 문구를 보여준다
const EMPTY_BY_STATUS: Record<BookStatus, { title: string; desc: string }> = {
  wishlist: { title: '읽고 싶은 책이 아직 없어요', desc: '관심 가는 책을 담아두세요' },
  reading: { title: '읽는 중인 책이 없어요', desc: '책을 골라 읽기 시작해보세요' },
  done: { title: '완독한 책이 아직 없어요', desc: '다 읽은 책을 완독 처리해보세요' },
}

const CARET =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a8a29e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"

export default function BooksTab({ books, quotes }: { books: Book[]; quotes: Quote[] }) {
  const { openBookDetail, openAddBook } = useAppUI()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  // 필터가 걸리면 제목 옆 meta가 그 상태의 권수를 대신 보여준다 (칩에서 카운트를 뺀 자리)
  const headerMeta =
    statusFilter === 'all'
      ? `${books.length}권`
      : `${STATUSES.find((s) => s.id === statusFilter)!.label} ${books.filter((b) => b.status === statusFilter).length}권`

  const filtered = books
    .filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sort === 'newest') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sort === 'title') return a.title.localeCompare(b.title, 'ko')
      if (sort === 'finishedAt') return (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')
      return 0
    })

  // 빈 상태 세 가지: 책이 아예 없음 / 상태 필터에 해당하는 책이 없음 / 검색 결과가 없음
  const empty =
    books.length === 0
      ? { title: '아직 책이 없어요', desc: '"+ 책 추가" 버튼으로 시작해보세요' }
      : !search && statusFilter !== 'all'
        ? EMPTY_BY_STATUS[statusFilter]
        : { title: '검색 결과가 없어요', desc: '다른 검색어를 시도해보세요' }

  return (
    <div>
      <PageHeader title="서재" meta={headerMeta}>
        <button
          onClick={openAddBook}
          className="text-xs sm:text-[13px] font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-ink text-bg border-none cursor-pointer hover:opacity-90"
        >
          + 책 추가
        </button>
      </PageHeader>

      <div className="flex flex-col gap-2.5 mb-5">
        <div className="flex gap-0.5 p-0.5 rounded-[9px] bg-surface2 border border-border sm:self-start">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`flex-1 sm:flex-none sm:px-6 py-1.5 rounded-md text-[13px] border-none cursor-pointer transition-colors duration-150 ${
                statusFilter === s.id ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 rounded-lg bg-surface border border-border focus-within:border-accent">
          <span className="text-dim flex-shrink-0">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="제목 또는 저자 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none text-ink py-[9px] text-base font-sans placeholder:text-dim focus:outline-none"
          />
          <span className="w-px self-stretch my-1.5 bg-border flex-shrink-0" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="flex-shrink-0 appearance-none bg-transparent bg-no-repeat bg-[right_center] border-none pr-4 py-[9px] text-xs text-dim font-sans cursor-pointer outline-none"
            style={{ backgroundImage: `url("${CARET}")` }}
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
            <IconBooks size={22} />
          </div>
          <h3 className="font-sans text-ink mb-1.5 text-[15px]">{empty.title}</h3>
          <p className="text-sm">{empty.desc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 sm:gap-[18px]">
          {filtered.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              quoteCount={quotes.filter((q) => q.bookId === b.id).length}
              onClick={() => openBookDetail(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
