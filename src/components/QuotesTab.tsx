import { useState } from 'react'
import type { Quote, Book } from '../types'
import QuoteCard from './QuoteCard'
import { useAppUI } from '../contexts/AppUIContext'
import { IconSearch, IconCollection } from './layout/icons'

interface Props {
  quotes: Quote[]
  books: Book[]
  onDeleteQuote: (id: string) => void
}

export default function QuotesTab({ quotes, books, onDeleteQuote }: Props) {
  const { openBookDetail, openAddQuote } = useAppUI()
  const [search, setSearch] = useState('')


  const filtered = [...quotes]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .filter((q) => {
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
      <div className="mb-5 w-full flex gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 rounded-lg bg-surface border border-border focus-within:border-accent">
          <span className="text-dim flex-shrink-0"><IconSearch /></span>
          <input
            type="text"
            placeholder="문장 · 책 · 저자 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-none text-ink py-[9px] text-base font-sans placeholder:text-dim focus:outline-none"
          />
        </div>
        <button onClick={() => openAddQuote()} className="flex-shrink-0 text-xs sm:text-[13px] font-medium px-3 sm:px-4 rounded-lg bg-ink text-bg border-none cursor-pointer hover:opacity-90">+ 문장 저장</button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim"><IconCollection size={20} /></div>
          <h3 className="font-sans text-ink mb-1.5 text-[15px]">{quotes.length === 0 ? '아직 모은 문장이 없어요' : '검색 결과가 없어요'}</h3>
          <p className="text-sm">{quotes.length === 0 ? '책 상세 페이지에서 문장을 추가할 수 있어요' : '다른 조건으로 검색해보세요'}</p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {filtered.map((q) => (
            <QuoteCard key={q.id} quote={q} book={books.find((b) => b.id === q.bookId)} onBookClick={openBookDetail} onEdit={() => openAddQuote(undefined, q.id)} onDelete={() => onDeleteQuote(q.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
