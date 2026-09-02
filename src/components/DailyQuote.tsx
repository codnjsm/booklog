import { useState } from 'react'
import type { Quote, Book } from '../types'

interface Props {
  quotes: Quote[]
  books: Book[]
}

export default function DailyQuote({ quotes, books }: Props) {
  const [offset, setOffset] = useState(() => Math.floor(Math.random() * Math.max(quotes.length, 1)))

  const quote = quotes.length > 0 ? quotes[offset % quotes.length] : null
  const book = quote ? books.find((b) => b.id === quote.bookId) : null

  const handleClick = () => {
    if (quotes.length > 1) setOffset((o) => o + 1)
  }

  return (
    <div
      className={`bg-gradient-to-br from-surface to-surface2 border border-border border-l-[3px] border-l-accent rounded-[10px] px-4 py-3.5 sm:px-[26px] sm:py-[22px] mb-5 sm:mb-8 relative${quotes.length > 1 ? ' cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="text-[11px] uppercase tracking-[0.15em] text-accent mb-2.5">오늘의 문장</div>
      {quote ? (
        <>
          <div className="font-serif text-base text-ink leading-[1.7] mb-2.5 font-normal">"{quote.text}"</div>
          {book && <div className="text-xs sm:text-[13px] text-dim">{book.title}{book.author ? ` — ${book.author}` : ''}</div>}
        </>
      ) : (
        <div className="text-dim text-base">아직 모은 문장이 없어요. 책을 추가하고 마음에 드는 문장을 저장해보세요.</div>
      )}
    </div>
  )
}
