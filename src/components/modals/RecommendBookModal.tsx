import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Modal from './Modal'
import type { Book, UserProfile } from '../../types'
import { friendlyErrorMessage } from '../../firebase'
import { useAppUI } from '../../contexts/AppUIContext'
import { IconChevronRight } from '../layout/icons'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[480px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans placeholder:text-dim placeholder:opacity-50'
/** 네이티브 select와 같은 상자. 안에 아바타가 들어가므로 높이를 내용이 정하게 둔다. */
const TRIGGER = `${FORM_INPUT} flex items-center gap-2 text-left cursor-pointer`
/**
 * 최대 높이는 한 줄 47px 기준 4줄(188px). 이보다 키우면 모달 패널(overflow-y-auto) 아래로
 * 넘쳐서 마지막 줄이 잘린다 — 트리거 아래로 남는 공간이 모바일 209px, 데스크톱 216px이다.
 */
const DROPDOWN =
  'absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-border rounded-xl shadow-card overflow-hidden max-h-[188px] overflow-y-auto'
/** border-none과 border-b를 같이 주면 style이 none이라 선이 안 그려진다. 알림함 목록과 같은 처리. */
const OPTION =
  'w-full flex items-center gap-2 px-3 py-2.5 text-left bg-transparent border-0 border-b border-border last:border-b-0 cursor-pointer hover:bg-surface2'
const FORM_TEXTAREA =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-sm sm:text-[15px] font-sans placeholder:text-dim placeholder:opacity-50 resize-none min-h-[122px] overflow-y-auto leading-[1.6]'
const BTN =
  'bg-ink text-bg border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'recommend-book-modal-title'

/** 친구 목록과 같은 모양. 사진이 없으면 accent 원에 이름 첫 글자. */
function Avatar({ url, name }: { url?: string; name: string }) {
  if (url)
    return (
      <img
        loading="lazy"
        className="w-[26px] h-[26px] rounded-full object-cover flex-shrink-0"
        src={url}
        referrerPolicy="no-referrer"
        alt=""
      />
    )
  return (
    <span className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center bg-accentfill text-white font-semibold text-xs">
      {name[0].toUpperCase()}
    </span>
  )
}

/** 이름이 비어 있으면 이메일 앞부분. 친구 목록·알림함과 같은 규칙. */
function friendName(f: UserProfile): string {
  return f.displayName?.trim() || f.email?.split('@')[0] || '이름 없는 친구'
}

interface Props {
  book: Book
  friends: UserProfile[]
  onClose: () => void
  onRecommend: (toUid: string, bookId: string, message: string) => Promise<void>
}

export default function RecommendBookModal({ book, friends, onClose, onRecommend }: Props) {
  const { showToast } = useAppUI()
  const [toUid, setToUid] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const picked = friends.find((f) => f.uid === toUid)

  // Escape는 드롭다운만 닫는다. Modal도 document에서 Escape를 듣고 있어서, 캡처 단계에서
  // 먼저 받아 전파를 끊지 않으면 모달까지 같이 닫힌다.
  useEffect(() => {
    if (!pickerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setPickerOpen(false)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [pickerOpen])

  const recommendMutation = useMutation({
    mutationFn: () => {
      if (!toUid) throw new Error('받을 친구를 고르지 않았습니다')
      return onRecommend(toUid, book.id, message.trim())
    },
    onSuccess: () => {
      showToast('친구에게 권했어요', 'success')
      onClose()
    },
    onError: (err) => showToast(friendlyErrorMessage(err, '네트워크 문제로 실패했어요. 다시 시도해주세요'), 'error'),
  })

  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-medium">
            친구에게 권하기
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          <div className="flex gap-2.5 bg-surface2 rounded-lg p-2.5 mb-3.5">
            <div className="w-11 h-16 rounded bg-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
              {book.cover ? (
                <img src={book.cover} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[9px] text-dim text-center px-0.5 leading-tight">{book.title}</span>
              )}
            </div>
            <div className="self-center flex-1 min-w-0">
              <div className="text-[13px] font-medium text-ink truncate">{book.title}</div>
              <div className="text-xs sm:text-[13px] text-dim truncate mt-0.5">{book.author}</div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              aria-label={picked ? `친구 선택: ${friendName(picked)}` : '친구 선택'}
              className={TRIGGER}
            >
              {picked ? (
                <>
                  <Avatar url={picked.photoURL} name={friendName(picked)} />
                  <span className="flex-1 min-w-0 truncate">{friendName(picked)}</span>
                </>
              ) : (
                <span className="flex-1 text-dim">친구 선택</span>
              )}
              {/* 아래를 가리키게 90도 돌린다 — 드롭다운 전용 아이콘을 따로 두지 않는다 */}
              <span
                className={`flex-shrink-0 text-dim transition-transform ${pickerOpen ? '-rotate-90' : 'rotate-90'}`}
              >
                <IconChevronRight />
              </span>
            </button>

            {pickerOpen && (
              <>
                {/* 바깥을 눌러 닫는다. 알림함과 같은 방식 */}
                <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
                <div role="listbox" aria-label="친구 선택" className={DROPDOWN}>
                  {friends.map((f) => (
                    <button
                      key={f.uid}
                      type="button"
                      role="option"
                      aria-selected={f.uid === toUid}
                      onClick={() => {
                        setToUid(f.uid)
                        setPickerOpen(false)
                      }}
                      className={OPTION}
                    >
                      <Avatar url={f.photoURL} name={friendName(f)} />
                      <span className="flex-1 min-w-0 truncate text-[13px] sm:text-[14px] text-ink">
                        {friendName(f)}
                      </span>
                      {f.uid === toUid && <span className="flex-shrink-0 text-[13px] text-accent">선택됨</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="왜 권하는지 한마디 적어주세요 (안 적어도 돼요)"
            className={`${FORM_TEXTAREA} mt-3.5`}
            maxLength={300}
          />

          <div className="flex justify-end gap-2 mt-3.5">
            <button className={BTN_SECONDARY} onClick={onClose}>
              취소
            </button>
            <button
              className={BTN}
              disabled={!toUid || recommendMutation.isPending}
              onClick={() => recommendMutation.mutate()}
            >
              {recommendMutation.isPending ? '보내는 중…' : '권하기'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
