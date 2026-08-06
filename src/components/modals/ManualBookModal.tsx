import { useState } from 'react'
import Modal from './Modal'
import type { Book, BookPrefill, BookStatus } from '../../types'
import DatePicker from '../DatePicker'

const STATUSES: { id: BookStatus; emoji: string; label: string }[] = [
  { id: 'wishlist', emoji: '📚', label: '읽고싶음' },
  { id: 'reading', emoji: '📖', label: '읽는중' },
  { id: 'done', emoji: '✅', label: '완독' },
]

const today = new Date().toISOString().slice(0, 10)

function toInputDate(iso?: string) {
  return iso ? iso.slice(0, 10) : ''
}
function toISOFromInput(val: string) {
  return val ? val + 'T12:00:00.000Z' : undefined
}

function defaultStartDate(status: BookStatus, existingDate?: string) {
  if (existingDate) return toInputDate(existingDate)
  return (status === 'reading' || status === 'done') ? today : ''
}

interface Props { prefill?: BookPrefill | Partial<Book>; editId?: string; books: Book[]; onClose: () => void; onSave: (data: Omit<Book, 'id' | 'createdAt'>, editId?: string) => void }

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
  const [startedAt, setStartedAt] = useState(() => defaultStartDate(initStatus, existing?.startedAt))
  const [finishedAt, setFinishedAt] = useState(toInputDate(existing?.finishedAt))

  const handleStatusChange = (s: BookStatus) => {
    setStatus(s)
    if ((s === 'reading' || s === 'done') && !startedAt) setStartedAt(today)
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal">
        <div className="modal-header"><h3>{editId ? '책 편집' : '책 추가'}</h3><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group"><label>제목 <span style={{ color: 'var(--danger)' }}>*</span></label><input type="text" placeholder="책 제목" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!prefill?.title} /></div>
          <div className="form-group"><label>저자</label><input type="text" placeholder="저자명" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
          <div className="form-group"><label>표지 이미지 URL</label><input type="text" placeholder="https://..." value={cover} onChange={(e) => setCover(e.target.value)} /></div>
          <div className="form-group"><label>출판 연도</label><input type="number" placeholder="2024" value={year} onChange={(e) => setYear(e.target.value)} /></div>
          <div className="form-group">
            <label>상태</label>
            <div className="status-options">
              {STATUSES.map((s) => <div key={s.id} className={`status-option${status === s.id ? ' selected' : ''}`} onClick={() => handleStatusChange(s.id)}>{s.emoji} {s.label}</div>)}
            </div>
          </div>
          {(status === 'reading' || status === 'done') && (
            <div className="form-group">
              <label>시작 날짜</label>
              <DatePicker value={startedAt} max={today} onChange={setStartedAt} />
            </div>
          )}
          {status === 'done' && (
            <div className="form-group">
              <label>완독 날짜</label>
              <DatePicker value={finishedAt} max={today} onChange={setFinishedAt} />
            </div>
          )}
          <div className="form-group">
            <label>별점</label>
            <div className="star-input">
              {[1,2,3,4,5].map((n) => <span key={n} className={`star${rating >= n ? ' filled' : ''}`} onClick={() => setRating(rating === n ? 0 : n)}>★</span>)}
            </div>
          </div>
          <div className="form-group"><label>독후감 / 메모</label><textarea placeholder="이 책에 대한 생각을 자유롭게 적어보세요…" value={review} onChange={(e) => setReview(e.target.value)} /></div>
          <div className="form-group">
            <label className="private-toggle-label">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <span>친구에게 비공개</span>
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn" onClick={() => {
            if (!title.trim()) return
            onSave({
              title: title.trim(), author: author.trim(), cover: cover.trim(), year: year.trim(),
              status, rating, review: review.trim(),
              startedAt: (status === 'reading' || status === 'done') ? toISOFromInput(startedAt) : undefined,
              finishedAt: status === 'done' ? toISOFromInput(finishedAt) : undefined,
              isPrivate: isPrivate || undefined,
            }, editId)
          }} disabled={!title.trim()}>저장</button>
        </div>
      </div>
    </Modal>
  )
}
