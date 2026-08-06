import { useState } from 'react'
import type { Book } from '../types'

const STATUS_INFO = {
  wishlist: { label: '읽고싶음' },
  reading: { label: '읽는중' },
  done: { label: '완독' },
}

interface Props {
  book: Book
  quoteCount: number
  onClick: () => void
}

export default function BookCard({ book, quoteCount, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const status = STATUS_INFO[book.status]

  return (
    <div className="book-card" data-status={book.status} onClick={onClick}>
      <div className="book-cover">
        {book.cover && !imgError ? (
          <img src={book.cover} alt={book.title} onError={() => setImgError(true)} />
        ) : (
          <div className="book-cover-fallback">
            <div className="title-text">{book.title}</div>
            <div className="author-text">{book.author}</div>
          </div>
        )}
        <div className="book-status-badge" data-status={book.status}>{status.label}</div>
      </div>
      <div className="book-info">
        <div className="book-meta">
          <span style={{ letterSpacing: '1px' }}>
            <span style={{ color: '#f59e0b' }}>{'★'.repeat(book.rating || 0)}</span>
            <span style={{ color: 'var(--text-dim)', opacity: 0.4 }}>{'☆'.repeat(5 - (book.rating || 0))}</span>
          </span>
          {quoteCount > 0 && <span className="quotes-count">💬 {quoteCount}</span>}
        </div>
        <div className="book-title">{book.title}{book.isPrivate && <span className="book-private-badge">🔒</span>}</div>
        <div className="book-author">{book.author || '저자 미상'}</div>
      </div>
    </div>
  )
}
