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
    <div className="daily-quote" onClick={handleClick} style={quotes.length > 1 ? { cursor: 'pointer' } : undefined}>
      <div className="daily-quote-label">오늘의 문장</div>
      {quote ? (
        <>
          <div className="daily-quote-text">"{quote.text}"</div>
          {book && <div className="daily-quote-source">{book.title}{book.author ? ` — ${book.author}` : ''}</div>}
        </>
      ) : (
        <div className="daily-quote-empty">아직 모은 문장이 없어요. 책을 추가하고 마음에 드는 문장을 저장해보세요.</div>
      )}
    </div>
  )
}
