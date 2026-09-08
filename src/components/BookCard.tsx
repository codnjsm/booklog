import { useState } from 'react'
import type { Book } from '../types'
import { IconBooks, IconCollection, IconLock } from './layout/icons'
import Stars from './Stars'

const STATUS_INFO = {
  wishlist: { label: '읽고싶음' },
  reading: { label: '읽는중' },
  done: { label: '완독' },
}

/**
 * 내 책(Book)과 친구 책(FriendBook) 양쪽에서 쓴다.
 * 카드가 실제로 그리는 필드만 요구하도록 좁혀둔다 — 이러면 친구 책장에
 * 독후감 같은 걸 넘기려 해도 타입에서 걸린다.
 */
type CardBook = Pick<Book, 'title' | 'author' | 'cover' | 'status' | 'rating'> & {
  isPrivate?: boolean
}

interface Props {
  book: CardBook
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
          <img
            src={book.cover}
            alt={book.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-4 font-sans">
            <span className="sm:hidden text-dim">
              <IconBooks size={26} />
            </span>
            <div className="hidden sm:block text-xs sm:text-[13px] font-semibold mb-1.5 text-ink/70 leading-snug">
              {book.title}
            </div>
            <div className="hidden sm:block text-xs sm:text-[13px] text-dim">{book.author}</div>
          </div>
        )}
        <div
          className={`absolute top-2 right-2 text-xs sm:text-[13px] px-2 py-1 rounded font-medium ${isDone ? 'bg-accent text-white border border-transparent' : 'bg-surface text-ink border border-border'}`}
        >
          {status.label}
        </div>
      </div>
      <div className="flex-1 sm:flex-none px-3.5 py-3 sm:pt-3 sm:pb-4 flex flex-col justify-start">
        <div className="flex justify-between items-center text-xs sm:text-[13px] text-dim mb-2 sm:mb-[15px]">
          <span className="text-ink">
            <Stars rating={book.rating || 0} size={11} showEmpty />
          </span>
          {quoteCount > 0 && (
            <span className="bg-surface2 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <IconCollection size={11} />
              {quoteCount}
            </span>
          )}
        </div>
        <div className="text-[15px] sm:text-base font-semibold mb-1 leading-[1.3] flex items-center line-clamp-2">
          {book.title}
          {book.isPrivate && (
            <span className="text-dim ml-1 inline-flex items-center">
              <IconLock size={12} />
            </span>
          )}
        </div>
        <div className="text-xs sm:text-[13px] text-dim mb-2 sm:mb-2.5">{book.author || '저자 미상'}</div>
      </div>
    </div>
  )
}
