import type { Quote, Book } from '../types'
import HighlightedText from './HighlightedText'

interface Props {
  quote: Quote
  book?: Book
  onBookClick: (id: string) => void
  onEdit: () => void
  onDelete: () => void
}

const BTN_SMALL_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'
const BTN_SMALL_DANGER =
  'bg-transparent text-danger border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10'

export default function QuoteCard({ quote, book, onBookClick, onEdit, onDelete }: Props) {
  return (
    <div className="bg-surface border border-border rounded-[10px] px-4 py-3.5 sm:px-[22px] sm:py-5 transition-all duration-150 shadow-[inset_3px_0_0_var(--accent)] hover:border-accent">
      <div className="font-serif text-sm sm:text-base leading-[1.7] mb-3 text-ink">
        &ldquo;
        <HighlightedText text={quote.text} highlights={quote.highlights} />
        &rdquo;
      </div>
      {quote.note && <div className="text-xs text-dim mb-2.5 italic pl-3 border-l-2 border-border">{quote.note}</div>}
      <div className="text-xs sm:text-[13px] text-dim mb-2.5">
        {book ? (
          <>
            <a className="text-accent no-underline cursor-pointer hover:underline" onClick={() => onBookClick(book.id)}>
              {book.title}
            </a>
            {book.author ? ` · ${book.author}` : ''}
          </>
        ) : (
          '출처 미상'
        )}
        {quote.page ? ` · p. ${quote.page}` : ''}
      </div>
      <div className="flex gap-1.5 justify-end">
        <button className={BTN_SMALL_SECONDARY} onClick={onEdit}>
          편집
        </button>
        <button className={BTN_SMALL_DANGER} onClick={onDelete}>
          삭제
        </button>
      </div>
    </div>
  )
}
