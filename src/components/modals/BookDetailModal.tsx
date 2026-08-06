import Modal from './Modal'
import type { Book, Quote } from '../../types'

const STATUS_INFO = { wishlist: { emoji: '📚', label: '읽고싶음' }, reading: { emoji: '📖', label: '읽는중' }, done: { emoji: '✅', label: '완독' } }

interface Props { bookId: string; books: Book[]; quotes: Quote[]; onClose: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onAddQuote: (bookId: string) => void; onEditQuote: (id: string) => void }

export default function BookDetailModal({ bookId, books, quotes, onClose, onEdit, onDelete, onAddQuote, onEditQuote }: Props) {
  const book = books.find((b) => b.id === bookId)
  if (!book) return null
  const bookQuotes = quotes.filter((q) => q.bookId === bookId)
  const status = STATUS_INFO[book.status]

  return (
    <Modal onClose={onClose}>
      <div className="modal">
        <div className="modal-header"><h3>{book.title}</h3><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '100px', aspectRatio: '2/3', flexShrink: 0, background: 'var(--surface-2)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {book.cover ? <img src={book.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : <div style={{ fontSize: '32px' }}>📕</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{book.title}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '8px' }}>{book.author || '저자 미상'}{book.year ? ` · ${book.year}` : ''}</div>
              <div style={{ marginBottom: '8px' }}><span style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '3px 9px', borderRadius: '999px', fontSize: '12px' }}>{status.emoji} {status.label}</span></div>
              {book.rating > 0 && <div className="stars">{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</div>}
            </div>
          </div>
          {book.review && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>독후감</div>
              <div style={{ background: 'var(--bg)', padding: '14px 16px', borderRadius: '8px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{book.review}</div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>인용구 ({bookQuotes.length})</div>
            <button className="btn btn-small" onClick={() => onAddQuote(bookId)}>+ 문장 추가</button>
          </div>
          {bookQuotes.length === 0
            ? <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-dim)' }}>이 책에서 모은 문장이 아직 없어요</div>
            : bookQuotes.map((q) => (
              <div key={q.id} className="detail-quote-item">
                <div className="detail-quote-text">"{q.text}"</div>
                {q.note && <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '6px' }}>{q.note}</div>}
                <div className="detail-quote-meta">
                  <div>{q.page ? `p. ${q.page}` : ''}{(q.tags || []).length > 0 ? ` · ${q.tags.map((t) => '#' + t).join(' ')}` : ''}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-small btn-secondary" onClick={() => onEditQuote(q.id)}>편집</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => onEdit(bookId)}>편집</button>
          <button className="btn btn-danger" onClick={() => onDelete(bookId)}>책 삭제</button>
        </div>
      </div>
    </Modal>
  )
}
