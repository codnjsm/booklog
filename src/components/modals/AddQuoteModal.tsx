import { useRef, useState } from 'react'
import Modal from './Modal'
import type { Book, Quote, HighlightColor } from '../../types'
import { useAppUI } from '../../contexts/AppUIContext'
import { ocrBookPage } from '../../firebase'
import { fileToResizedBase64 } from '../../lib/image'
import HighlightedText, { mergeRanges, subtractRange, HIGHLIGHT_COLORS } from '../HighlightedText'

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
  'bg-surface border border-border rounded-2xl w-full max-w-full min-h-[min(500px,90%)] sm:min-h-0 sm:max-w-[560px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px] text-[13px] sm:text-[14px]'
const MODAL_ACTIONS = 'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border'
const FORM_LABEL = 'flex text-xs sm:text-[13px] mb-1.5 uppercase tracking-[.05em] text-dim'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans placeholder:text-dim placeholder:opacity-50 focus:border-accent'
const FORM_TEXTAREA = `${FORM_INPUT} resize-none min-h-[90px] max-h-[500px] overflow-y-auto leading-[1.6]`
// 문장 입력칸 앞에는 항상 이 카드의 삭제(×) 버튼이 absolute로 얹혀있어 DOM상 첫 형제가 아닐 수
// 있다. :first-child에 기대는 대신, 구분선이 필요한 두 번째·세 번째 섹션에만 이 클래스를 준다.
const FORM_SECTION = 'mt-4 pt-4 border-t border-border'

/** 최소 높이는 유지하되 내용이 길어지면 500px까지 늘어나고, 그 이상은 내부 스크롤로 처리한다. */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 500)}px`
}
const FORM_SELECT = `${FORM_INPUT} pr-8`
const BTN =
  'bg-ink text-bg border-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'
const BTN_DANGER =
  'bg-transparent text-danger border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-colors duration-200 font-sans hover:bg-dangersoft'
const BTN_SMALL_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'
const BTN_SMALL_PRIMARY =
  'bg-ink text-bg border-none px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'

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
  const photoInputRef = useRef<HTMLInputElement>(null)
  const ocrTargetIndexRef = useRef<number | null>(null)
  const ocrPreviewRef = useRef<HTMLTextAreaElement | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  // 사진에서 인식한 텍스트를 바로 문장 칸에 넣지 않고, 전체를 쓸지 일부만 골라 쓸지 먼저 확인받는다.
  const [ocrPreview, setOcrPreview] = useState<{ index: number; text: string } | null>(null)
  // 마지막으로 고른 형광펜 색. 매번 다시 고르지 않아도 되게 다음 칠하기에도 그대로 쓴다.
  const [pickedColor, setPickedColor] = useState<HighlightColor>('lime')

  const updateEntry = (i: number, field: 'text' | 'note', val: string) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)))

  const markHighlight = (i: number, color: HighlightColor) => {
    const el = textRefs.current[i]
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    if (start === end) {
      showToast('형광펜을 칠할 부분을 먼저 드래그해주세요')
      return
    }
    setPickedColor(color)
    setEntries((prev) =>
      prev.map((e, idx) =>
        idx === i
          ? {
              // 칠하려는 자리에 이미 있던 구간은 먼저 도려낸다. 안 그러면 색만 다른 구간이 겹쳐 쌓여서
              // 처음 칠한 색이 계속 이기고, 다시 눌러도 색이 안 바뀐다.
              ...e,
              highlights: mergeRanges([...subtractRange(e.highlights ?? [], { start, end }), { start, end, color }]),
            }
          : e,
      ),
    )
  }

  const clearHighlights = (i: number) =>
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, highlights: undefined } : e)))

  const addEntry = () => setEntries((prev) => [...prev, { text: '', note: '' }])
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i))

  const triggerPhotoImport = (i: number) => {
    ocrTargetIndexRef.current = i
    photoInputRef.current?.click()
  }

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetIndex = ocrTargetIndexRef.current
    e.target.value = ''
    if (!file || targetIndex === null) return

    setOcrLoading(true)
    try {
      const base64 = await fileToResizedBase64(file)
      const text = (await ocrBookPage(base64)).trim()
      if (!text) {
        showToast('사진에서 문장을 찾지 못했어요', 'error')
        return
      }
      setOcrPreview({ index: targetIndex, text })
    } catch {
      showToast('사진에서 텍스트를 읽어오지 못했어요', 'error')
    } finally {
      setOcrLoading(false)
    }
  }

  const applyOcrText = (text: string) => {
    if (!ocrPreview) return
    setEntries((prev) => prev.map((e, idx) => (idx === ocrPreview.index ? { ...e, text, highlights: undefined } : e)))
    setOcrPreview(null)
  }

  const applyOcrSelectionOnly = () => {
    const el = ocrPreviewRef.current
    if (!ocrPreview || !el) return
    const { selectionStart: start, selectionEnd: end } = el
    if (start === end) {
      showToast('넣을 부분을 먼저 드래그해주세요')
      return
    }
    applyOcrText(ocrPreview.text.slice(start, end))
  }

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
          color: r.color,
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
    <Modal onClose={onClose} labelledBy="add-quote-modal-title">
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id="add-quote-modal-title" className="font-sans text-base font-semibold">
            {editId ? '인용구 편집' : '인용구 추가'}
          </h3>
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
            <div key={i} className="bg-surface2 border border-border rounded-[10px] px-4 py-4 mb-3 relative">
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="absolute top-2 right-2.5 bg-none border-none text-dim cursor-pointer text-base leading-none p-0.5"
                >
                  ×
                </button>
              )}
              <div>
                {ocrPreview?.index === i ? (
                  <>
                    <label className="flex text-xs sm:text-[13px] uppercase tracking-[.05em] text-dim mb-1.5">
                      사진에서 인식한 문장
                    </label>
                    <p className="text-xs sm:text-[13px] text-dim mb-2">
                      필요한 부분만 넣고 싶다면 드래그로 선택한 뒤 아래 버튼을 눌러주세요.
                    </p>
                    <textarea
                      ref={(el) => {
                        ocrPreviewRef.current = el
                        autoResizeTextarea(el)
                      }}
                      readOnly
                      defaultValue={ocrPreview.text}
                      className={`${FORM_TEXTAREA} mb-0`}
                    />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <button type="button" className={BTN_SMALL_SECONDARY} onClick={() => setOcrPreview(null)}>
                        취소
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={applyOcrSelectionOnly}
                        className={BTN_SMALL_SECONDARY}
                      >
                        선택한 부분만 넣기
                      </button>
                      <button type="button" className={BTN_SMALL_PRIMARY} onClick={() => applyOcrText(ocrPreview.text)}>
                        전체 넣기
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="flex text-xs sm:text-[13px] uppercase tracking-[.05em] text-dim">
                        문장 <span className="text-danger">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => triggerPhotoImport(i)}
                        disabled={ocrLoading}
                        className="text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-full bg-accentsoft text-accent border-none cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {ocrLoading ? '인식 중…' : '+ 사진으로 추가'}
                      </button>
                    </div>
                    <textarea
                      ref={(el) => {
                        textRefs.current[i] = el
                        autoResizeTextarea(el)
                      }}
                      placeholder="간직하고 싶은 문장을 적어보세요"
                      value={entry.text}
                      onChange={(e) => updateEntry(i, 'text', e.target.value)}
                      className={`${FORM_TEXTAREA} mb-0`}
                    />
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs sm:text-[13px] text-dim">형광펜</span>
                      {/* 원형 아이콘은 자기 박스 정중앙이 곧 잉크 중심이지만, 한글 글자는 실제 획이
                          줄박스 위쪽에 쏠려있어 items-center로 맞춰도 원이 살짝 처져 보인다. 눈에 맞게 보정. */}
                      {/* 보이는 원은 20px이지만 버튼(=터치 영역)은 24px로 둔다 — WCAG 2.2의 최소 타겟 크기.
                          원 둘레의 2px 여백이 예전 gap-1을 대신하므로 간격은 그대로 4px로 보인다. */}
                      <div className="flex items-center -translate-y-px">
                        {HIGHLIGHT_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => markHighlight(i, c.id)}
                            aria-label={`${c.label} 형광펜`}
                            title={c.label}
                            className="w-6 h-6 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer"
                          >
                            <span
                              className={`block w-5 h-5 rounded-full border transition-transform duration-100 ${
                                pickedColor === c.id ? 'border-ink scale-110' : 'border-border'
                              }`}
                              style={{ background: `var(--highlight-${c.id})` }}
                            />
                          </button>
                        ))}
                      </div>
                      {entry.highlights?.length ? (
                        <>
                          <span className="font-mono text-xs sm:text-[13px] text-dim">{entry.highlights.length}곳</span>
                          <button
                            type="button"
                            onClick={() => clearHighlights(i)}
                            className="text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-full bg-dangersoft text-danger border-none cursor-pointer hover:opacity-80"
                          >
                            모두 지우기
                          </button>
                        </>
                      ) : (
                        <span className="text-xs sm:text-[13px] text-dim">칠할 부분을 드래그한 뒤 눌러주세요</span>
                      )}
                    </div>
                  </>
                )}
              </div>
              {ocrPreview?.index !== i && entry.highlights?.length && entry.text ? (
                <div className={FORM_SECTION}>
                  <div className="text-xs sm:text-[13px] mb-1 text-dim">미리보기</div>
                  <div className="rounded-lg bg-surface2 px-3.5 py-3 font-serif text-[13px] sm:text-[14px] leading-[1.8]">
                    <HighlightedText text={entry.text} highlights={entry.highlights} />
                  </div>
                </div>
              ) : null}
              <div className={FORM_SECTION}>
                <label className={FORM_LABEL}>나의 생각</label>
                <textarea
                  ref={(el) => autoResizeTextarea(el)}
                  placeholder="이 문장에 대한 느낌이나 생각"
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
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} className="hidden" />
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
