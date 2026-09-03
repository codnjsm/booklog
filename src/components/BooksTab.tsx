import { useState } from 'react'
import type { Book, Quote, BookStatus } from '../types'
import BookCard from './BookCard'
import { useAppUI } from '../contexts/AppUIContext'
import PageHeader from './layout/PageHeader'

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

const CARET = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a8a29e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"

function chipClass(isActive: boolean) {
  const base = "px-3 py-[9px] border rounded-full text-xs cursor-pointer transition-all duration-150 font-sans"
  return isActive
    ? `${base} bg-accentsoft border-accent text-accent`
    : `${base} bg-surface border-border text-dim hover:text-ink`
}

export default function BooksTab({ books, quotes }: { books: Book[]; quotes: Quote[] }) {
  const { openBookDetail, openAddBook } = useAppUI()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('newest')

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

  return (
    <div>
      <PageHeader title="서재" meta={`${books.length}권`}>
        <button onClick={openAddBook} className="text-xs sm:text-[13px] font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-ink text-bg border-none cursor-pointer hover:opacity-90">+ 책 추가</button>
      </PageHeader>
      <div className="flex flex-col gap-3 mb-5 flex-wrap items-start w-full">
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => {
            const count = s.id === 'all' ? books.length : books.filter((b) => b.status === s.id).length
            const isActive = statusFilter === s.id
            return (
              <button key={s.id} className={chipClass(isActive)} onClick={() => setStatusFilter(s.id)}>
                {s.label} ({count})
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 items-center w-full">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="제목 또는 저자 검색…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface border border-border text-ink px-3.5 py-[9px] rounded-lg text-base font-sans focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-[105px] flex-shrink-0 pl-3.5 pr-7 py-[9px] appearance-none bg-surface bg-no-repeat bg-[right_10px_center] border border-border rounded-full text-xs text-dim font-sans cursor-pointer outline-none"
            style={{ backgroundImage: `url("${CARET}")` }}
          >
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <div className="text-[40px] mb-3 opacity-60">📚</div>
          <h3 className="font-sans text-ink mb-1.5 text-[15px]">{books.length === 0 ? '아직 책이 없어요' : '검색 결과가 없어요'}</h3>
          <p className="text-sm">{books.length === 0 ? '"+ 책 추가" 버튼으로 시작해보세요' : '다른 검색어를 시도해보세요'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5 sm:gap-[18px]">
          {filtered.map((b) => (
            <BookCard key={b.id} book={b} quoteCount={quotes.filter((q) => q.bookId === b.id).length} onClick={() => openBookDetail(b.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
