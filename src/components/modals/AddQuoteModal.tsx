import { useState } from 'react'
import Modal from './Modal'
import type { Book, Quote } from '../../types'

interface Props { books: Book[]; quotes: Quote[]; bookId?: string | null; editId?: string; onClose: () => void; onSave: (data: Omit<Quote, 'id' | 'createdAt'>, editId?: string) => void; onDelete?: (id: string) => void }

interface Entry { text: string; note: string }

export default function AddQuoteModal({ books, quotes, bookId, editId, onClose, onSave, onDelete }: Props) {
  const existing = editId ? quotes.find((q) => q.id === editId) : null
  const [selectedBookId, setSelectedBookId] = useState(existing?.bookId ?? bookId ?? '')
  const [entries, setEntries] = useState<Entry[]>(
    existing ? [{ text: existing.text, note: existing.note ?? '' }] : [{ text: '', note: '' }]
  )

  const updateEntry = (i: number, field: keyof Entry, val: string) =>
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  const addEntry = () => setEntries((prev) => [...prev, { text: '', note: '' }])
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    const valid = entries.filter((e) => e.text.trim())
    if (valid.length === 0) return
    valid.forEach((e) => onSave({ bookId: selectedBookId || null, text: e.text.trim(), page: '', tags: [], note: e.note.trim() }, editId))
  }

  const canSave = entries.some((e) => e.text.trim())

  return (
    <Modal onClose={onClose}>
      <div className="modal">
        <div className="modal-header"><h3>{editId ? '인용구 편집' : '인용구 추가'}</h3><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group">
            <label>책</label>
            <select value={selectedBookId ?? ''} onChange={(e) => setSelectedBookId(e.target.value)}>
              <option value="">— 책 선택 —</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.author ? ` — ${b.author}` : ''}</option>)}
            </select>
          </div>

          {entries.map((entry, i) => (
            <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, position: 'relative' }}>
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
                >×</button>
              )}
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>문장 <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea
                  placeholder="간직하고 싶은 문장을 적어보세요…"
                  value={entry.text}
                  onChange={(e) => updateEntry(i, 'text', e.target.value)}
                  autoFocus={i === 0}
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>나의 생각</label>
                <textarea
                  placeholder="이 문장에 대한 느낌이나 생각…"
                  value={entry.note}
                  onChange={(e) => updateEntry(i, 'note', e.target.value)}
                  style={{ minHeight: '60px', marginBottom: 0 }}
                />
              </div>
            </div>
          ))}

          {!editId && (
            <button type="button" className="btn btn-secondary btn-small" onClick={addEntry}>
              + 문장 추가
            </button>
          )}
        </div>
        <div className="modal-actions">
          {editId && onDelete && (
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => { if (confirm('이 문장을 삭제할까요?')) onDelete(editId) }}>삭제</button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn" onClick={handleSave} disabled={!canSave}>저장</button>
        </div>
      </div>
    </Modal>
  )
}
