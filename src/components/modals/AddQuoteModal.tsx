import { useRef, useState } from 'react'
import Modal from './Modal'
import type { Book, Quote } from '../../types'
import { useAppUI } from '../../contexts/AppUIContext'
import HighlightedText, { mergeRanges } from '../HighlightedText'

interface Props {
  books: Book[]
  quotes: Quote[]
  bookId?: string | null
  editId?: string
  onClose: () => void
  onSave: (data: Omit<Quote, 'id' | 'createdAt'>, editId?: string) => void
  onDelete?: (id: string) => void
}

interface Entry {
  text: string
  note: string
  highlights?: Quote['highlights']
}

const MODAL_PANEL =
  'bg-surface border border-border rounded-t-2xl sm:rounded-xl w-full max-w-full sm:max-w-[560px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px] text-sm sm:text-[15px]'
const MODAL_ACTIONS =
  'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-4'
const FORM_LABEL = 'flex text-xs text-dim mb-1.5 uppercase tracking-[.05em]'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-base font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent'
const FORM_TEXTAREA = `${FORM_INPUT} resize-y min-h-[90px] leading-[1.6]`
const FORM_SELECT = `${FORM_INPUT} pr-8`
const BTN =
  'bg-ink text-bg border-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'
const BTN_DANGER =
  'bg-transparent text-danger border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10'
const BTN_SMALL_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'

export default function AddQuoteModal({ books, quotes, bookId, editId, onClose, onSave, onDelete }: Props) {
  const { showToast } = useAppUI()
  const existing = editId ? quotes.find((q) => q.id === editId) : null
  const [selectedBookId, setSelectedBookId] = useState(existing?.bookId ?? bookId ?? '')
  const [entries, setEntries] = useState<Entry[]>(
    existing
      ? [{ text: existing.text, note: existing.note ?? '', highlights: existing.highlights }]
      : [{ text: '', note: '' }],
  )
  const textRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  const updateEntry = (i: number, field: 'text' | 'note', val: string) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)))

  const markHighlight = (i: number) => {
    const el = textRefs.current[i]
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    if (start === end) {
      showToast('형광펜을 칠할 부분을 먼저 드래그해주세요')
      return
    }
    setEntries((prev) =>
      prev.map((e, idx) =>
        idx === i ? { ...e, highlights: mergeRanges([...(e.highlights ?? []), { start, end }]) } : e,
      ),
    )
  }

  const clearHighlights = (i: number) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, highlights: undefined } : e)))
  const addEntry = () => setEntries((prev) => [...prev, { text: '', note: '' }])
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    const valid = entries.filter((e) => e.text.trim())
    if (valid.length === 0) return
    valid.forEach((e) => {
      // 저장할 때 앞뒤 공백을 잘라내므로 형광펜 인덱스도 같은 만큼 당겨준다.
      const text = e.text.trim()
      const offset = e.text.length - e.text.trimStart().length
      const shifted = mergeRanges(
        (e.highlights ?? []).map((r) => ({
          start: Math.max(0, r.start - offset),
          end: Math.min(text.length, Math.max(0, r.end - offset)),
        })),
      )
      onSave(
        {
          bookId: selectedBookId || null,
          text,
          page: '',
          tags: [],
          note: e.note.trim(),
          highlights: shifted.length ? shifted : undefined,
        },
        editId,
      )
    })
  }

  const canSave = entries.some((e) => e.text.trim())

  return (
    <Modal onClose={onClose}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 className="font-sans text-base font-semibold">{editId ? '인용구 편집' : '인용구 추가'}</h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          <div className="mb-3.5">
            <label className={FORM_LABEL}>책</label>
            <select
              value={selectedBookId ?? ''}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className={FORM_SELECT}
            >
              <option value="">— 책 선택 —</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                  {b.author ? ` — ${b.author}` : ''}
                </option>
              ))}
            </select>
          </div>

          {entries.map((entry, i) => (
            <div key={i} className="bg-surface2 border border-border rounded-[10px] px-3.5 py-3 mb-2.5 relative">
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="absolute top-2 right-2.5 bg-none border-none text-dim cursor-pointer text-base leading-none p-0.5"
                >
                  ×
                </button>
              )}
              <div className="mb-2">
                <label className={FORM_LABEL}>
                  문장 <span className="text-danger">*</span>
                </label>
                <textarea
                  ref={(el) => {
                    textRefs.current[i] = el
                  }}
                  placeholder="간직하고 싶은 문장을 적어보세요…"
                  value={entry.text}
                  onChange={(e) => updateEntry(i, 'text', e.target.value)}
                  className={`${FORM_TEXTAREA} mb-0`}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => markHighlight(i)}
                    className={`${BTN_SMALL_SECONDARY} flex items-center gap-1.5`}
                  >
                    <span className="w-3 h-2 rounded-sm bg-highlight" />
                    형광펜
                  </button>
                  {entry.highlights?.length ? (
                    <>
                      <span className="font-mono text-[11px] text-dim">{entry.highlights.length}곳</span>
                      <button
                        type="button"
                        onClick={() => clearHighlights(i)}
                        className="text-xs text-dim bg-transparent border-none cursor-pointer p-0 hover:text-ink"
                      >
                        모두 지우기
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-dim">칠할 부분을 드래그한 뒤 눌러주세요</span>
                  )}
                </div>
                {entry.highlights?.length && entry.text ? (
                  <div className="mt-2 rounded-[7px] border border-border bg-bg px-3 py-2 font-serif text-sm sm:text-base leading-[1.8]">
                    <HighlightedText text={entry.text} highlights={entry.highlights} />
                  </div>
                ) : null}
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
            <button
              className={`${BTN_DANGER} mr-auto`}
              onClick={() => {
                if (confirm('이 문장을 삭제할까요?')) onDelete(editId)
              }}
            >
              삭제
            </button>
          )}
          <button className={BTN_SECONDARY} onClick={onClose}>
            취소
          </button>
          <button className={BTN} onClick={handleSave} disabled={!canSave}>
            저장
          </button>
        </div>
      </div>
    </Modal>
  )
}
