import { useState } from 'react'
import Modal from './Modal'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[420px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const MODAL_ACTIONS = 'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans placeholder:text-dim placeholder:opacity-50'
const BTN_DANGER =
  'bg-danger text-white border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'delete-account-modal-title'

/** 실수로 눌러 계정을 잃는 일이 없도록, 이 글자를 직접 입력해야 버튼이 열린다. */
const CONFIRM_WORD = '탈퇴'

interface Props {
  /** 지울 항목을 구체적으로 보여줘야 무엇을 잃는지 알고 결정할 수 있다. */
  recordCount: number
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export default function DeleteAccountModal({ recordCount, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canDelete = typed.trim() === CONFIRM_WORD && !deleting

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canDelete) return
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal onClose={deleting ? () => {} : onCancel} labelledBy={TITLE_ID}>
      <form className={MODAL_PANEL} onSubmit={submit}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-semibold">
            회원 탈퇴
          </h3>
          <button type="button" className={MODAL_CLOSE} onClick={onCancel} disabled={deleting} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={MODAL_BODY}>
          <p className="text-[13px] sm:text-sm text-ink leading-relaxed">
            탈퇴하면 아래가 <span className="font-semibold text-danger">모두 영구히 삭제</span>되고 되돌릴 수 없어요.
          </p>
          <ul className="mt-2.5 flex flex-col gap-1 text-xs sm:text-[13px] text-dim">
            <li>· 기록한 책·문장·단어 {recordCount}개</li>
            <li>· 친구 관계와 친구에게 공유한 게시물</li>
            <li>· 프로필과 계정</li>
          </ul>
          <p className="text-xs sm:text-[13px] text-dim mt-3 leading-relaxed">
            남기고 싶은 기록이 있다면 취소하고 <span className="text-ink">더보기 → 기록 내보내기</span>를 먼저 해주세요.
          </p>

          <div className="mt-4">
            <p className="text-xs sm:text-[13px] text-dim mb-2">
              계속하려면 <span className="font-semibold text-ink">{CONFIRM_WORD}</span> 를 입력해주세요.
            </p>
            <input
              type="text"
              value={typed}
              autoFocus
              disabled={deleting}
              aria-label={`확인 문구 ${CONFIRM_WORD}`}
              placeholder={CONFIRM_WORD}
              onChange={(e) => setTyped(e.target.value)}
              className={FORM_INPUT}
            />
          </div>
        </div>

        <div className={MODAL_ACTIONS}>
          <button type="button" className={BTN_SECONDARY} onClick={onCancel} disabled={deleting}>
            취소
          </button>
          <button type="submit" className={BTN_DANGER} disabled={!canDelete}>
            {deleting ? '삭제 중…' : '영구 삭제'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
