import { useState } from 'react'
import Modal from './Modal'
import type { Book, Quote } from '../../types'

interface Props { books: Book[]; quotes: Quote[]; bookId?: string | null; editId?: string; onClose: () => void; onSave: (data: Omit<Quote, 'id' | 'createdAt'>, editId?: string) => void; onDelete?: (id: string) => void }

interface Entry { text: string; note: string }

const MODAL_PANEL = "bg-surface border border-border rounded-t-2xl sm:rounded-xl w-full max-w-full sm:max-w-[560px] max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-card"
const MODAL_HEADER = "pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center"
const MODAL_CLOSE = "bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink"
const MODAL_BODY = "px-[18px] py-3.5 sm:px-6 sm:py-[22px] text-sm sm:text-[15px]"
const MODAL_ACTIONS = "flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-4"
const FORM_LABEL = "flex text-xs text-dim mb-1.5 uppercase tracking-[.05em]"
const FORM_INPUT = "w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-base font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent"
const FORM_TEXTAREA = `${FORM_INPUT} resize-y min-h-[90px] leading-[1.6]`
const FORM_SELECT = `${FORM_INPUT} pr-8`
const BTN = "bg-ink text-bg border-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
const BTN_SECONDARY = "bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"
const BTN_DANGER = "bg-transparent text-danger border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10"
const BTN_SMALL_SECONDARY = "bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"

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
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}><h3 className="font-sans text-base font-semibold">{editId ? '인용구 편집' : '인용구 추가'}</h3><button className={MODAL_CLOSE} onClick={onClose}>×</button></div>
        <div className={MODAL_BODY}>
          <div className="mb-3.5">
            <label className={FORM_LABEL}>책</label>
            <select value={selectedBookId ?? ''} onChange={(e) => setSelectedBookId(e.target.value)} className={FORM_SELECT}>
              <option value="">— 책 선택 —</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.author ? ` — ${b.author}` : ''}</option>)}
            </select>
          </div>

          {entries.map((entry, i) => (
            <div key={i} className="bg-surface2 border border-border rounded-[10px] px-3.5 py-3 mb-2.5 relative">
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="absolute top-2 right-2.5 bg-none border-none text-dim cursor-pointer text-base leading-none p-0.5"
                >×</button>
              )}
              <div className="mb-2">
                <label className={FORM_LABEL}>문장 <span className="text-danger">*</span></label>
                <textarea
                  placeholder="간직하고 싶은 문장을 적어보세요…"
                  value={entry.text}
                  onChange={(e) => updateEntry(i, 'text', e.target.value)}
                  autoFocus={i === 0}
                  className={`${FORM_TEXTAREA} mb-0`}
                />
              </div>
              <div>
                <label className={FORM_LABEL}>나의 생각</label>
                <textarea
                  placeholder="이 문장에 대한 느낌이나 생각…"
                  value={entry.note}
                  onChange={(e) => updateEntry(i, 'note', e.target.value)}
                  className={`${FORM_TEXTAREA} min-h-[60px] mb-0`}
                />
              </div>
            </div>
          ))}

          {!editId && (
            <button type="button" className={BTN_SMALL_SECONDARY} onClick={addEntry}>
              + 문장 추가
            </button>
          )}
        </div>
        <div className={MODAL_ACTIONS}>
          {editId && onDelete && (
            <button className={`${BTN_DANGER} mr-auto`} onClick={() => { if (confirm('이 문장을 삭제할까요?')) onDelete(editId) }}>삭제</button>
          )}
          <button className={BTN_SECONDARY} onClick={onClose}>취소</button>
          <button className={BTN} onClick={handleSave} disabled={!canSave}>저장</button>
        </div>
      </div>
    </Modal>
  )
}
