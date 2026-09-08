import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Modal from './Modal'
import type { Book, Quote } from '../../types'
import { useAppUI } from '../../contexts/AppUIContext'
import HighlightedText from '../HighlightedText'

const STATUS_BADGE = {
  wishlist: { label: '읽고싶음', cls: 'border border-border text-dim' },
  reading: { label: '읽는중', cls: 'border border-ink text-ink' },
  done: { label: '완독', cls: 'bg-accent text-white' },
}

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[560px] min-h-[min(500px,90%)] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const FORM_TEXTAREA =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent resize-none min-h-[90px] max-h-[500px] overflow-y-auto leading-[1.6]'

/** 최소 높이는 유지하되 내용이 길어지면 500px까지 늘어나고, 그 이상은 내부 스크롤로 처리한다. */
function autoResizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 500)}px`
}
const BTN =
  'bg-ink text-bg border-none px-4 py-2.5 rounded-lg text-[13px] cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] cursor-pointer hover:bg-surface2'
const SEG =
  'flex-1 sm:flex-none sm:px-6 py-1.5 rounded-md text-[13px] border-none cursor-pointer transition-colors duration-150'
const TITLE_ID = 'publish-post-modal-title'

type Kind = 'quote' | 'book'
type Selected = { kind: Kind; refId: string }

interface Props {
  books: Book[]
  quotes: Quote[]
  onClose: () => void
  onPublish: (data: { kind: Kind; refId: string; caption: string }) => Promise<{ id: string }>
  onPublished: () => void
}

export default function PublishPostModal({ books, quotes, onClose, onPublish, onPublished }: Props) {
  const { showToast } = useAppUI()
  const [kindFilter, setKindFilter] = useState<Kind>('quote')
  const [picked, setPicked] = useState<Selected | null>(null)
  const [caption, setCaption] = useState('')

  // 비공개 책, 비공개 책에 속한 인용구는 목록에 아예 안 보여준다 (서버가 어차피 거부하지만
  // 고른 다음에 에러를 보게 하지 않는다)
  const pickableBooks = books.filter((b) => !b.isPrivate)
  const pickableQuotes = quotes.filter((q) => {
    if (!q.bookId) return true
    const book = books.find((b) => b.id === q.bookId)
    return !book?.isPrivate
  })

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!picked) throw new Error('선택된 항목이 없습니다')
      return onPublish({ kind: picked.kind, refId: picked.refId, caption: caption.trim() })
    },
    onSuccess: () => {
      showToast('친구에게 공유했어요')
      onPublished()
      onClose()
    },
    onError: (err) => showToast(err instanceof Error ? err.message : '공유 중 오류가 발생했어요'),
  })

  const captionValid = caption.trim().length > 0 && caption.trim().length <= 300

  const pickedQuote = picked?.kind === 'quote' ? quotes.find((q) => q.id === picked.refId) : undefined
  const pickedBook =
    picked?.kind === 'book'
      ? books.find((b) => b.id === picked.refId)
      : pickedQuote?.bookId
        ? books.find((b) => b.id === pickedQuote.bookId)
        : undefined

  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-semibold">
            친구에게 공유하기
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          {!picked ? (
            <>
              <div className="flex gap-0.5 p-0.5 mb-3.5 rounded-[9px] bg-surface2 border border-border sm:w-fit">
                <button
                  onClick={() => setKindFilter('quote')}
                  className={`${SEG} ${kindFilter === 'quote' ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'}`}
                >
                  문장
                </button>
                <button
                  onClick={() => setKindFilter('book')}
                  className={`${SEG} ${kindFilter === 'book' ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'}`}
                >
                  책
                </button>
              </div>

              {kindFilter === 'quote' ? (
                pickableQuotes.length === 0 ? (
                  <p className="text-sm text-dim text-center py-8">공유할 수 있는 문장이 없어요</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {pickableQuotes.map((q) => {
                      const book = q.bookId ? books.find((b) => b.id === q.bookId) : undefined
                      return (
                        <button
                          key={q.id}
                          onClick={() => setPicked({ kind: 'quote', refId: q.id })}
                          className="text-left bg-surface2 border border-border rounded-lg px-3.5 py-3 cursor-pointer hover:border-accent"
                        >
                          <div className="font-serif text-sm leading-[1.7] text-ink line-clamp-3">{q.text}</div>
                          {book && <div className="text-xs text-dim mt-1.5">{book.title}</div>}
                        </button>
                      )
                    })}
                  </div>
                )
              ) : pickableBooks.length === 0 ? (
                <p className="text-sm text-dim text-center py-8">공유할 수 있는 책이 없어요</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {pickableBooks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setPicked({ kind: 'book', refId: b.id })}
                      className="text-left flex gap-2.5 bg-surface2 border border-border rounded-lg p-2.5 cursor-pointer hover:border-accent"
                    >
                      <div className="w-11 h-16 rounded bg-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {b.cover ? (
                          <img src={b.cover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-dim text-center px-0.5 leading-tight">{b.title}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">{b.title}</div>
                        <div className="text-xs text-dim truncate mt-0.5">{b.author}</div>
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 ${STATUS_BADGE[b.status].cls}`}
                        >
                          {STATUS_BADGE[b.status].label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setPicked(null)}
                className="flex items-center gap-1.5 text-xs text-accent bg-transparent border-none cursor-pointer p-0 mb-3"
              >
                <span className="text-lg leading-none relative top-[-2px]">‹</span>
                다른 걸 고르기
              </button>

              {picked.kind === 'quote' && pickedQuote ? (
                <div className="bg-surface2 rounded-lg px-3.5 py-3 mb-3.5">
                  <div className="font-serif text-sm sm:text-base leading-[1.8] text-ink">
                    &ldquo;
                    <HighlightedText text={pickedQuote.text} highlights={pickedQuote.highlights} />
                    &rdquo;
                  </div>
                  {pickedBook && <div className="text-xs text-dim mt-2">{pickedBook.title}</div>}
                </div>
              ) : (
                pickedBook && (
                  <div className="flex gap-2.5 bg-surface2 rounded-lg p-2.5 mb-3.5">
                    <div className="w-11 h-16 rounded bg-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {pickedBook.cover ? (
                        <img src={pickedBook.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-dim text-center px-0.5 leading-tight">{pickedBook.title}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{pickedBook.title}</div>
                      <div className="text-xs text-dim truncate mt-0.5">{pickedBook.author}</div>
                    </div>
                  </div>
                )
              )}

              <textarea
                ref={(el) => autoResizeTextarea(el)}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="이걸 왜 공유하고 싶은지 한마디 적어주세요"
                className={FORM_TEXTAREA}
                maxLength={300}
              />
              <div className="flex justify-end gap-2 mt-3.5">
                <button className={BTN_SECONDARY} onClick={onClose}>
                  취소
                </button>
                <button
                  className={BTN}
                  disabled={!captionValid || publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                >
                  {publishMutation.isPending ? '공유 중…' : '공유하기'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
