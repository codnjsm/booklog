import { useState } from 'react'
import Modal from './Modal'
import type { Book, Quote } from '../../types'
import { readingSince, readDaysCount } from '../../lib/insights'
import HighlightedText from '../HighlightedText'
import { IconLock } from '../layout/icons'
import Stars from '../Stars'

const STATUS = {
  wishlist: { label: '읽고싶음', cls: 'border border-border text-dim' },
  reading: { label: '읽는중', cls: 'border border-ink text-ink' },
  done: { label: '완독', cls: 'bg-accent text-white' },
}

const PANEL =
  'bg-surface border border-border rounded-2xl sm:rounded-[14px] w-full max-w-full min-h-[min(500px,90%)] sm:max-w-[620px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const LABEL = 'font-mono text-[10px] tracking-[0.09em] text-dim'
const BTN =
  'text-xs sm:text-[13px] font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accenthover'
const BTN_2 =
  'text-xs sm:text-[13px] px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-surface text-ink border border-border cursor-pointer hover:bg-surface2'
const BTN_SM =
  'text-xs px-3 py-1.5 rounded-md bg-surface text-ink border border-border cursor-pointer hover:bg-surface2'

function fmt(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  bookId: string
  books: Book[]
  quotes: Quote[]
  onClose: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAddQuote: (bookId: string) => void
  onEditQuote: (id: string) => void
  onTogglePrivate: (id: string, next: boolean) => void
}

export default function BookDetailModal({
  bookId,
  books,
  quotes,
  onClose,
  onEdit,
  onDelete,
  onAddQuote,
  onEditQuote,
  onTogglePrivate,
}: Props) {
  const book = books.find((b) => b.id === bookId)
  const [coverError, setCoverError] = useState(false)
  if (!book) return null

  const bookQuotes = quotes.filter((q) => q.bookId === bookId)
  const status = STATUS[book.status]
  const isPrivate = !!book.isPrivate

  // 상태 뱃지가 이미 상태를 보여주므로 그리드에는 날짜/기간만 넣는다.
  // 위시리스트는 정보가 하나뿐이라 그리드 대신 아래 period 한 줄로 둔다.
  const stats: { label: string; value: string }[] =
    book.status === 'done' && book.finishedAt
      ? [
          { label: 'STARTED', value: fmt(readingSince(book)) },
          { label: 'FINISHED', value: fmt(book.finishedAt) },
          { label: 'ELAPSED', value: `${readDaysCount(book)}일` },
        ]
      : book.status === 'reading'
        ? [
            { label: 'STARTED', value: fmt(readingSince(book)) },
            { label: 'ELAPSED', value: `${readDaysCount(book)}일째` },
          ]
        : []

  const period = `${fmt(book.createdAt)} 담아둠`

  // 표지 옆 세로 공간을 채운다. 모바일은 칼럼이 좁아 3칸이 겹치므로 2칸으로 접는다.
  const statsGrid =
    stats.length > 0 ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-3 border-y border-border">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <span className={LABEL}>{s.label}</span>
            <span className="font-mono text-[13px] text-ink">{s.value}</span>
          </div>
        ))}
      </div>
    ) : null

  return (
    <Modal onClose={onClose}>
      <div className={PANEL}>
        <div className="sticky top-0 z-10 bg-surface flex items-center justify-between pl-6 pr-4 py-3.5 border-b border-border">
          <span className={LABEL}>BOOK</span>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-7 h-7 flex items-center justify-center rounded-md bg-transparent border-none cursor-pointer text-dim hover:text-ink"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-5 sm:p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 sm:gap-5">
              <div className="w-[104px] sm:w-[124px] flex-shrink-0">
                {book.cover && !coverError ? (
                  <img
                    src={book.cover}
                    alt=""
                    onError={() => setCoverError(true)}
                    className="w-full aspect-[2/3] object-cover rounded-md border border-border"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded-md bg-surface2 border border-border flex items-center justify-center p-3">
                    <span className="text-xs font-semibold leading-snug text-center text-ink/70">{book.title}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {book.rating > 0 && (
                    <span className="text-ink">
                      <Stars rating={book.rating} size={14} showEmpty />
                    </span>
                  )}
                  {/* 별점이 없어도 뱃지는 항상 오른쪽 끝에 붙는다 */}
                  <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
                <h3 className="text-lg sm:text-[22px] font-semibold leading-snug tracking-[-0.01em]">{book.title}</h3>
                <div className="text-[13px] text-dim">
                  {book.author || '저자 미상'}
                  {book.year ? ` · ${book.year}` : ''}
                </div>
                {!statsGrid && <div className="font-mono text-[11px] text-dim mt-0.5">{period}</div>}
                <div className="flex-1" />
                {statsGrid}
              </div>
            </div>

            <div className="flex gap-2">
              <button className={`${BTN} flex-1`} onClick={() => onAddQuote(bookId)}>
                + 문장 저장
              </button>
              <button className={`${BTN_2} flex-1`} onClick={() => onEdit(bookId)}>
                기록 수정
              </button>
            </div>
          </div>

          <button
            onClick={() => onTogglePrivate(bookId, !isPrivate)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] border border-border bg-transparent cursor-pointer text-left w-full"
          >
            <span className="text-dim">
              <IconLock />
            </span>
            <span className="flex flex-col gap-px">
              <span className="text-[13px] font-medium text-ink">친구에게 비공개</span>
              <span className="text-[11px] text-dim">
                {isPrivate ? '친구 책장에서 이 책이 숨겨져 있어요' : '친구가 내 책장을 볼 때 이 책도 보여요'}
              </span>
            </span>
            <span className="flex-1" />
            <span
              className={`relative w-[38px] h-[22px] rounded-full flex-shrink-0 transition-colors ${isPrivate ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className={`absolute top-[3px] w-4 h-4 rounded-full bg-surface transition-all ${isPrivate ? 'left-[19px]' : 'left-[3px]'}`}
              />
            </span>
          </button>

          {book.review ? (
            <div className="flex flex-col gap-2">
              <div className={LABEL}>REVIEW</div>
              <div className="bg-surface2 rounded-[10px] px-4 py-3.5 text-sm leading-[1.8] whitespace-pre-wrap">
                {book.review}
              </div>
            </div>
          ) : (
            <button
              onClick={() => onEdit(bookId)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] border border-dashed border-border bg-transparent cursor-pointer text-left"
            >
              <span className="text-dim">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
                </svg>
              </span>
              <span className="text-[13px] text-dim">독후감을 아직 안 썼어요</span>
              <span className="flex-1" />
              <span className="text-xs font-medium text-accent">쓰기</span>
            </button>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className={LABEL}>QUOTES {bookQuotes.length}</div>
              {bookQuotes.length > 0 && (
                <button className={BTN_SM} onClick={() => onAddQuote(bookId)}>
                  + 문장 추가
                </button>
              )}
            </div>

            {bookQuotes.length === 0 ? (
              <div className="border border-dashed border-border rounded-[10px] bg-bg px-5 py-7 flex flex-col items-center gap-3">
                <p className="font-serif text-sm sm:text-base text-dim text-center leading-relaxed">
                  읽다가 마음에 걸린 문장을
                  <br />
                  여기에 모아두세요
                </p>
                <button className={BTN} onClick={() => onAddQuote(bookId)}>
                  + 첫 문장 저장하기
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {bookQuotes.map((q) => (
                  <div key={q.id} className="border border-border rounded-[10px] px-4 py-3.5 flex flex-col gap-2">
                    <div className="font-serif text-sm sm:text-base leading-[1.9]">
                      &ldquo;
                      <HighlightedText text={q.text} highlights={q.highlights} />
                      &rdquo;
                    </div>
                    {q.note && (
                      <div className="text-xs leading-relaxed text-dim pl-3 border-l-2 border-border">{q.note}</div>
                    )}
                    <div className="flex items-center gap-2">
                      {q.page && <span className="font-mono text-[10px] text-dim">p.{q.page}</span>}
                      <span className="flex-1" />
                      <button
                        onClick={() => onEditQuote(q.id)}
                        aria-label="문장 편집"
                        className="text-dim hover:text-ink bg-transparent border-none cursor-pointer p-0"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 sm:px-6 py-3.5 border-t border-border bg-bg">
          <button
            onClick={() => onDelete(bookId)}
            className="text-xs sm:text-[13px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-transparent border border-border text-danger cursor-pointer hover:bg-danger/10"
          >
            책 삭제
          </button>
          <span className="flex-1" />
          <button className={BTN_2} onClick={() => onEdit(bookId)}>
            책 정보 편집
          </button>
        </div>
      </div>
    </Modal>
  )
}
