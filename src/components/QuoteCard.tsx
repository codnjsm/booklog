import type { Quote, Book } from '../types'

interface Props {
  quote: Quote
  book?: Book
  onBookClick: (id: string) => void
  onEdit: () => void
  onDelete: () => void
  onTagClick: (tag: string) => void
}

export default function QuoteCard({ quote, book, onBookClick, onEdit, onDelete, onTagClick }: Props) {
  return (
    <div className="quote-card">
      <div className="quote-text">"{quote.text}"</div>
      {quote.note && (
        <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '10px', fontStyle: 'italic', paddingLeft: '12px', borderLeft: '2px solid var(--border)' }}>
          {quote.note}
        </div>
      )}
      <div className="quote-source">
        {book ? <><a onClick={() => onBookClick(book.id)}>{book.title}</a>{book.author ? ` · ${book.author}` : ''}</> : '출처 미상'}
        {quote.page ? ` · p. ${quote.page}` : ''}
      </div>
      {(quote.tags || []).length > 0 && (
        <div className="quote-tags">
          {quote.tags.map((t) => <span key={t} className="tag" onClick={() => onTagClick(t)}>#{t}</span>)}
        </div>
      )}
      <div className="quote-actions">
        <button className="btn btn-small btn-secondary" onClick={onEdit}>편집</button>
        <button className="btn btn-small btn-danger" onClick={onDelete}>삭제</button>
      </div>
    </div>
  )
}
