import { useState } from 'react'
import type { Quote, Book } from '../types'
import QuoteCard from './QuoteCard'

interface Props {
  quotes: Quote[]
  books: Book[]
  onBookClick: (id: string) => void
  onEditQuote: (id: string) => void
  onDeleteQuote: (id: string) => void
}

export default function QuotesTab({ quotes, books, onBookClick, onEditQuote, onDeleteQuote }: Props) {
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const tagCounts: Record<string, number> = {}
  quotes.forEach((q) => (q.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1 }))
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])

  const filtered = [...quotes]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .filter((q) => {
      if (tagFilter && !(q.tags || []).includes(tagFilter)) return false
      if (search) {
        const s = search.toLowerCase()
        const book = books.find((b) => b.id === q.bookId)
        if (!book) return false
        return book.title.toLowerCase().includes(s) || (book.author || '').toLowerCase().includes(s)
      }
      return true
    })

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <input type="text" placeholder="제목 또는 저자 검색…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {tags.length > 0 && (
        <div className="toolbar" style={{ marginTop: '-8px' }}>
          <div className="filter-chips">
            <button className={`chip${tagFilter === null ? ' active' : ''}`} onClick={() => setTagFilter(null)}>전체</button>
            {tags.map(([t, c]) => (
              <button key={t} className={`chip${tagFilter === t ? ' active' : ''}`} onClick={() => setTagFilter(t)}>#{t} ({c})</button>
            ))}
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">💬</div>
          <h3>{quotes.length === 0 ? '아직 모은 문장이 없어요' : '검색 결과가 없어요'}</h3>
          <p>{quotes.length === 0 ? '책 상세 페이지에서 문장을 추가할 수 있어요' : '다른 조건으로 검색해보세요'}</p>
        </div>
      ) : (
        <div className="quotes-list">
          {filtered.map((q) => (
            <QuoteCard key={q.id} quote={q} book={books.find((b) => b.id === q.bookId)} onBookClick={onBookClick} onEdit={() => onEditQuote(q.id)} onDelete={() => onDeleteQuote(q.id)} onTagClick={setTagFilter} />
          ))}
        </div>
      )}
    </div>
  )
}
