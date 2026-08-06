import { useState } from 'react'
import type { Book, Quote, BookStatus } from '../types'
import BookCard from './BookCard'

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

interface Props {
  books: Book[]
  quotes: Quote[]
  onBookClick: (id: string) => void
}

export default function BooksTab({ books, quotes, onBookClick }: Props) {
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
      <div className="toolbar">
        <div className="chips">
          {STATUSES.map((s) => {
            const count = s.id === 'all' ? books.length : books.filter((b) => b.status === s.id).length
            return (
              <button key={s.id} data-status={s.id} className={`chip${statusFilter === s.id ? ' active' : ''}`} onClick={() => setStatusFilter(s.id)}>
                {s.label} ({count})
              </button>
            )
          })}
        </div>
        <div className="search-sort-row">
          <div className="search-box">
            <input type="text" placeholder="제목 또는 저자 검색…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sort-select">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <h3>{books.length === 0 ? '아직 책이 없어요' : '검색 결과가 없어요'}</h3>
          <p>{books.length === 0 ? '"+ 책 추가" 버튼으로 시작해보세요' : '다른 검색어를 시도해보세요'}</p>
        </div>
      ) : (
        <div className="books-grid">
          {filtered.map((b) => (
            <BookCard key={b.id} book={b} quoteCount={quotes.filter((q) => q.bookId === b.id).length} onClick={() => onBookClick(b.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
