import { useState } from 'react'
import type { Quote, Book } from '../types'
import QuoteCard from './QuoteCard'
import { useAppUI } from '../contexts/AppUIContext'

interface Props {
  quotes: Quote[]
  books: Book[]
  onDeleteQuote: (id: string) => void
}

export default function QuotesTab({ quotes, books, onDeleteQuote }: Props) {
  const { openBookDetail, openAddQuote } = useAppUI()
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
      <div className="mb-5 w-full">
        <input
          type="text"
          placeholder="제목 또는 저자 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border text-ink px-3.5 py-[9px] rounded-lg text-base font-sans focus:outline-none focus:border-accent"
        />
      </div>
      {tags.length > 0 && (
        <div className="flex justify-between gap-3 items-center w-full mb-5">
          <div className="flex gap-1.5 flex-wrap">
            <button className={`px-3 py-[9px] bg-surface border rounded-full text-xs cursor-pointer transition-all duration-150 font-sans ${tagFilter === null ? 'bg-[var(--accent-soft)] border-accent text-accent' : 'border-border text-dim hover:text-ink'}`} onClick={() => setTagFilter(null)}>전체</button>
            {tags.map(([t, c]) => (
              <button key={t} className={`px-3 py-[9px] bg-surface border rounded-full text-xs cursor-pointer transition-all duration-150 font-sans ${tagFilter === t ? 'bg-[var(--accent-soft)] border-accent text-accent' : 'border-border text-dim hover:text-ink'}`} onClick={() => setTagFilter(t)}>#{t} ({c})</button>
            ))}
          </div>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <div className="text-[40px] mb-3 opacity-60">💬</div>
          <h3 className="font-sans text-ink mb-1.5 text-[15px]">{quotes.length === 0 ? '아직 모은 문장이 없어요' : '검색 결과가 없어요'}</h3>
          <p className="text-sm">{quotes.length === 0 ? '책 상세 페이지에서 문장을 추가할 수 있어요' : '다른 조건으로 검색해보세요'}</p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filtered.map((q) => (
            <QuoteCard key={q.id} quote={q} book={books.find((b) => b.id === q.bookId)} onBookClick={openBookDetail} onEdit={() => openAddQuote(undefined, q.id)} onDelete={() => onDeleteQuote(q.id)} onTagClick={setTagFilter} />
          ))}
        </div>
      )}
    </div>
  )
}
