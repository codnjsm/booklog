import { useState } from 'react'
import Modal from './Modal'
import type { Book, BookPrefill, BookStatus } from '../../types'
import DateMultiPicker from '../DateMultiPicker'
import { IconStar } from '../layout/icons'

const STATUSES: { id: BookStatus; label: string }[] = [
  { id: 'wishlist', label: '읽고싶음' },
  { id: 'reading', label: '읽는중' },
  { id: 'done', label: '완독' },
]

const today = new Date().toISOString().slice(0, 10)

function toInputDate(iso?: string) {
  return iso ? iso.slice(0, 10) : ''
}
function toISOFromInput(val: string) {
  return val ? val + 'T12:00:00.000Z' : undefined
}

function initialReadDates(existing: Book | null | undefined, status: BookStatus): string[] {
  if (existing?.readDates?.length) return [...existing.readDates].sort()
  const boundary = Array.from(
    new Set([existing?.startedAt, existing?.finishedAt].filter((iso): iso is string => !!iso).map(toInputDate)),
  ).sort()
  if (boundary.length) return boundary
  return status === 'reading' || status === 'done' ? [today] : []
}

function fmtDot(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}.${m}.${d}`
}

function readDatesSummary(dates: string[]) {
  const sorted = [...dates].sort()
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const range = first === last ? fmtDot(first) : `${fmtDot(first)} ~ ${fmtDot(last)}`
  return `${range} · ${dates.length}일`
}

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full min-h-[min(500px,90%)] sm:max-w-[560px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px] text-sm sm:text-[15px]'
const MODAL_ACTIONS = 'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border'
const FORM_GROUP = 'mb-3.5'
const FORM_LABEL = 'flex text-sm mb-1.5 uppercase tracking-[.05em] pl-2'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent'
const FORM_TEXTAREA = `${FORM_INPUT} resize-none min-h-[90px] max-h-[500px] overflow-y-auto leading-[1.6]`

/** 최소 높이는 유지하되 내용이 길어지면 500px까지 늘어나고, 그 이상은 내부 스크롤로 처리한다. */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 500)}px`
}
const BTN =
  'bg-ink text-bg border-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'

interface Props {
  prefill?: BookPrefill | Partial<Book>
  editId?: string
  books: Book[]
  onClose: () => void
  onSave: (data: Omit<Book, 'id' | 'createdAt'>, editId?: string) => void
}

export default function ManualBookModal({ prefill, editId, books, onClose, onSave }: Props) {
  const existing = editId ? books.find((b) => b.id === editId) : null
  const initStatus: BookStatus = existing?.status ?? 'reading'

  const [title, setTitle] = useState(prefill?.title ?? '')
  const [author, setAuthor] = useState(prefill?.author ?? '')
  const [cover, setCover] = useState(prefill?.cover ?? '')
  const [year, setYear] = useState(String(prefill?.year ?? ''))
  const [status, setStatus] = useState<BookStatus>(initStatus)
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [review, setReview] = useState(existing?.review ?? '')
  const [isPrivate, setIsPrivate] = useState(existing?.isPrivate ?? false)
  const [readDates, setReadDates] = useState<string[]>(() => initialReadDates(existing, initStatus))

  const handleStatusChange = (s: BookStatus) => {
    setStatus(s)
    if ((s === 'reading' || s === 'done') && readDates.length === 0) setReadDates([today])
  }

  return (
    <Modal onClose={onClose} labelledBy="manual-book-modal-title">
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id="manual-book-modal-title" className="font-sans text-base font-semibold">
            {editId ? '책 편집' : '책 추가'}
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>
              제목 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="책 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FORM_INPUT}
            />
          </div>
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>저자</label>
            <input
              type="text"
              placeholder="저자명"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={FORM_INPUT}
            />
          </div>
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>표지 이미지 URL</label>
            <input
              type="text"
              placeholder="https://..."
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              className={FORM_INPUT}
            />
          </div>
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>출판 연도</label>
            <input
              type="number"
              placeholder="2024"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={FORM_INPUT}
            />
          </div>
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>상태</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={status === s.id}
                  className={`py-[9px] px-2 rounded-[7px] text-center cursor-pointer text-[13px] transition-all duration-150 border ${status === s.id ? 'border-accent bg-accentsoft text-accent' : 'bg-bg border-border text-ink hover:border-dim'}`}
                  onClick={() => handleStatusChange(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {(status === 'reading' || status === 'done') && (
            <div className={FORM_GROUP}>
              <label className={FORM_LABEL}>읽은 날짜</label>
              <DateMultiPicker selected={readDates} onChange={setReadDates} max={today} />
              {readDates.length > 0 ? (
                <p className="mt-1.5 text-xs text-dim">{readDatesSummary(readDates)}</p>
              ) : (
                <p className="mt-1.5 text-xs text-danger">읽은 날짜를 하나 이상 선택해주세요</p>
              )}
            </div>
          )}
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>별점</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`별점 ${n}점`}
                  className={`bg-transparent border-none p-0 cursor-pointer transition-colors duration-100 ${rating >= n ? 'text-accent' : 'text-border'}`}
                  onClick={() => setRating(rating === n ? 0 : n)}
                >
                  <IconStar size={26} filled={rating >= n} />
                </button>
              ))}
            </div>
          </div>
          <div className={FORM_GROUP}>
            <label className={FORM_LABEL}>독후감 / 메모</label>
            <textarea
              ref={(el) => autoResizeTextarea(el)}
              placeholder="이 책에 대한 생각을 자유롭게 적어보세요…"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className={FORM_TEXTAREA}
            />
          </div>
          <div className={FORM_GROUP}>
            <label className="flex items-center gap-1.5 cursor-pointer text-sm text-ink select-none leading-none">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-[15px] h-[15px] accent-accent cursor-pointer flex-shrink-0 m-0"
              />
              <span>친구에게 비공개</span>
            </label>
          </div>
        </div>
        <div className={MODAL_ACTIONS}>
          <button className={BTN_SECONDARY} onClick={onClose}>
            취소
          </button>
          <button
            className={BTN}
            onClick={() => {
              const needsDates = status === 'reading' || status === 'done'
              if (!title.trim() || (needsDates && readDates.length === 0)) return
              const sortedDates = [...readDates].sort()
              onSave(
                {
                  title: title.trim(),
                  author: author.trim(),
                  cover: cover.trim(),
                  year: year.trim(),
                  status,
                  rating,
                  review: review.trim(),
                  readDates: needsDates ? sortedDates : undefined,
                  startedAt: needsDates ? toISOFromInput(sortedDates[0]) : undefined,
                  finishedAt: status === 'done' ? toISOFromInput(sortedDates[sortedDates.length - 1]) : undefined,
                  isPrivate: isPrivate || undefined,
                },
                editId,
              )
            }}
            disabled={!title.trim() || ((status === 'reading' || status === 'done') && readDates.length === 0)}
          >
            저장
          </button>
        </div>
      </div>
    </Modal>
  )
}
