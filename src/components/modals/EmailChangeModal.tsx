import { useState } from 'react'
import Modal from './Modal'
import { authErrorMessage } from '../../firebase'
import { useAppUI } from '../../contexts/AppUIContext'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[420px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const MODAL_ACTIONS = 'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans placeholder:text-dim placeholder:opacity-50'
const BTN =
  'bg-accentfill text-white border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-accentfillhover disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'email-change-modal-title'

interface Props {
  /** 지금 계정에 등록된 이메일. 같은 주소로는 바꿀 수 없게 비교에 쓴다. */
  current: string
  onClose: () => void
  onChangeEmail: (email: string) => Promise<void>
}

export default function EmailChangeModal({ current, onClose, onChangeEmail }: Props) {
  const { showToast } = useAppUI()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const trimmed = email.trim()
  const canSubmit = trimmed.length > 0 && trimmed.toLowerCase() !== current.toLowerCase() && !submitting

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onChangeEmail(trimmed)
      setSentTo(trimmed)
    } catch (err) {
      const shown = authErrorMessage(err)
      if (shown) showToast(shown.msg, shown.type)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <form className={MODAL_PANEL} onSubmit={submit}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-semibold">
            이메일 변경
          </h3>
          <button type="button" className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={MODAL_BODY}>
          {sentTo ? (
            <>
              <p className="text-[13px] sm:text-sm text-ink leading-relaxed">
                <span className="font-semibold">{sentTo}</span>으로 확인 메일을 보냈어요.
              </p>
              <p className="text-xs sm:text-[13px] text-dim mt-2.5 leading-relaxed">
                메일의 링크를 눌러야 이메일이 바뀌어요. 그때까지는 기존 이메일로 로그인하시면 되고, 기록은 그대로 남아
                있어요.
              </p>
            </>
          ) : (
            <>
              <input
                type="email"
                value={email}
                autoFocus
                aria-label="새 이메일"
                placeholder="새 이메일 주소"
                onChange={(e) => setEmail(e.target.value)}
                className={FORM_INPUT}
              />
              <p className="text-xs sm:text-[13px] text-dim mt-2.5 leading-relaxed">
                잘못 등록된 이메일 주소를 수정해요. 새로운 주소로 인증 메일을 보낼게요.
              </p>
            </>
          )}
        </div>

        <div className={MODAL_ACTIONS}>
          {sentTo ? (
            <button type="button" className={BTN} onClick={onClose}>
              확인
            </button>
          ) : (
            <>
              <button type="button" className={BTN_SECONDARY} onClick={onClose}>
                취소
              </button>
              <button type="submit" className={BTN} disabled={!canSubmit}>
                {submitting ? '보내는 중…' : '확인 메일 보내기'}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  )
}
