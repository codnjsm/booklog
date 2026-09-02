import Modal from './Modal'
import type { Book, Quote } from '../../types'

const STATUS_INFO = { wishlist: { emoji: '📚', label: '읽고싶음' }, reading: { emoji: '📖', label: '읽는중' }, done: { emoji: '✅', label: '완독' } }

const MODAL_PANEL = "bg-surface border border-border rounded-t-2xl sm:rounded-xl w-full max-w-full sm:max-w-[560px] max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-card"
const MODAL_HEADER = "pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center"
const MODAL_CLOSE = "bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink"
const MODAL_BODY = "px-[18px] py-3.5 sm:px-6 sm:py-[22px] text-sm sm:text-[15px]"
const MODAL_ACTIONS = "flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-4"
const BTN_SMALL = "bg-accent text-bg border-none px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-accenthover"
const BTN_SMALL_SECONDARY = "bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"
const BTN_SECONDARY = "bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"
const BTN_DANGER = "bg-transparent text-danger border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10"

interface Props { bookId: string; books: Book[]; quotes: Quote[]; onClose: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void; onAddQuote: (bookId: string) => void; onEditQuote: (id: string) => void }

export default function BookDetailModal({ bookId, books, quotes, onClose, onEdit, onDelete, onAddQuote, onEditQuote }: Props) {
  const book = books.find((b) => b.id === bookId)
  if (!book) return null
  const bookQuotes = quotes.filter((q) => q.bookId === bookId)
  const status = STATUS_INFO[book.status]

  return (
    <Modal onClose={onClose}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}><h3 className="font-sans text-base font-semibold">{book.title}</h3><button className={MODAL_CLOSE} onClick={onClose}>×</button></div>
        <div className={MODAL_BODY}>
          <div className="flex gap-4 mb-5">
            <div className="w-[100px] aspect-[2/3] flex-shrink-0 bg-surface2 rounded-md overflow-hidden flex items-center justify-center">
              {book.cover ? <img src={book.cover} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} /> : <div className="text-[32px]">📕</div>}
            </div>
            <div className="flex-1">
              <div className="font-semibold mb-1.5">{book.title}</div>
              <div className="text-dim text-sm mb-2">{book.author || '저자 미상'}{book.year ? ` · ${book.year}` : ''}</div>
              <div className="mb-2"><span className="bg-[var(--accent-soft)] text-accent px-2.5 py-[3px] rounded-full text-xs">{status.emoji} {status.label}</span></div>
              {book.rating > 0 && <div className="text-accent tracking-[1px]">{'★'.repeat(book.rating)}{'☆'.repeat(5 - book.rating)}</div>}
            </div>
          </div>
          {book.review && (
            <div className="mb-6">
              <div className="text-xs text-dim uppercase tracking-[0.05em] mb-2">독후감</div>
              <div className="bg-bg px-4 py-3.5 rounded-lg leading-[1.7] whitespace-pre-wrap">{book.review}</div>
            </div>
          )}
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-dim uppercase tracking-[0.05em]">인용구 ({bookQuotes.length})</div>
            <button className={BTN_SMALL} onClick={() => onAddQuote(bookId)}>+ 문장 추가</button>
          </div>
          {bookQuotes.length === 0
            ? <div className="text-center py-6 text-dim">이 책에서 모은 문장이 아직 없어요</div>
            : bookQuotes.map((q) => (
              <div key={q.id} className="bg-bg border border-border border-l-[3px] border-l-accent rounded-lg px-4 py-3.5 mb-2">
                <div className="font-serif text-[15px] leading-[1.6] text-left mb-2">"{q.text}"</div>
                {q.note && <div className="text-xs text-dim italic mb-1.5">{q.note}</div>}
                <div className="flex justify-between items-center text-[11px] text-dim">
                  <div>{q.page ? `p. ${q.page}` : ''}{(q.tags || []).length > 0 ? ` · ${q.tags.map((t) => '#' + t).join(' ')}` : ''}</div>
                  <div className="flex gap-1.5">
                    <button className={BTN_SMALL_SECONDARY} onClick={() => onEditQuote(q.id)}>편집</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        <div className={MODAL_ACTIONS}>
          <button className={BTN_SECONDARY} onClick={() => onEdit(bookId)}>편집</button>
          <button className={BTN_DANGER} onClick={() => onDelete(bookId)}>책 삭제</button>
        </div>
      </div>
    </Modal>
  )
}
