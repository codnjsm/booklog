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
  const isDone = book.status === 'done'

  return (
    <div
      className={`bg-surface border rounded-[10px] overflow-hidden cursor-pointer transition-all duration-200 flex flex-row sm:flex-col hover:-translate-y-[3px] hover:border-accent hover:shadow-card ${isDone ? 'border-accent/40 border-l-[3px] border-l-accent' : 'border-border'}`}
      onClick={onClick}
    >
      <div className="w-[90px] sm:w-full flex-shrink-0 sm:flex-shrink aspect-[2/3] bg-gradient-to-br from-surface2 to-bg flex items-center justify-center overflow-hidden relative rounded-none">
        {book.cover && !imgError ? (
          <img src={book.cover} alt={book.title} onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-4 font-sans">
            <span className="sm:hidden text-[28px]">📖</span>
            <div className="hidden sm:block text-base font-semibold mb-2 text-ink leading-[1.3]">{book.title}</div>
            <div className="hidden sm:block text-xs text-dim">{book.author}</div>
          </div>
        )}
        <div className={`absolute top-2 right-2 text-[11px] px-2 py-1 rounded font-medium ${isDone ? 'bg-accent text-white border border-transparent' : 'bg-surface text-ink border border-border'}`}>{status.label}</div>
      </div>
      <div className="flex-1 sm:flex-none px-3.5 py-3 sm:pt-3 sm:pb-4 flex flex-col justify-start">
        <div className="flex justify-between items-center text-[11px] text-dim mb-2 sm:mb-[15px]">
          <span className="tracking-[1px]">
            <span className="text-ink">{'★'.repeat(book.rating || 0)}</span>
            <span className="text-dim opacity-40">{'☆'.repeat(5 - (book.rating || 0))}</span>
          </span>
          {quoteCount > 0 && <span className="bg-surface2 px-1.5 py-0.5 rounded">💬 {quoteCount}</span>}
        </div>
        <div className="text-base font-semibold mb-1 leading-[1.3] flex items-center line-clamp-2">{book.title}{book.isPrivate && <span className="text-[11px] ml-1 pb-1">🔒</span>}</div>
        <div className="text-xs text-dim mb-2 sm:mb-2.5">{book.author || '저자 미상'}</div>
      </div>
    </div>
  )
}
