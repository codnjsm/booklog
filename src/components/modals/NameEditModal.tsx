import { useState } from 'react'
import Modal from './Modal'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[400px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const MODAL_ACTIONS = 'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border'
const FORM_LABEL = 'flex text-xs sm:text-[13px] mb-2 uppercase tracking-[.05em] text-dim'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans placeholder:text-dim placeholder:opacity-50'
const BTN =
  'bg-accentfill text-white border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-accentfillhover disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'name-edit-modal-title'

const MAX_LEN = 20

interface Props {
  current: string
  onCancel: () => void
  onSave: (name: string) => void
}

export default function NameEditModal({ current, onCancel, onSave }: Props) {
  const [name, setName] = useState(current)
  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed !== current

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (canSave) onSave(trimmed)
  }

  return (
    <Modal onClose={onCancel} labelledBy={TITLE_ID}>
      <form className={MODAL_PANEL} onSubmit={submit}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-semibold">
            이름 수정
          </h3>
          <button type="button" className={MODAL_CLOSE} onClick={onCancel} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={MODAL_BODY}>
          <label className={FORM_LABEL} htmlFor="name-edit-input">
            표시 이름
          </label>
          <input
            id="name-edit-input"
            type="text"
            value={name}
            autoFocus
            maxLength={MAX_LEN}
            placeholder="친구에게 보이는 이름"
            onChange={(e) => setName(e.target.value)}
            className={FORM_INPUT}
          />
          <p className="text-xs sm:text-[13px] text-dim mt-2">
            친구 목록과 피드에 이 이름으로 보입니다. {MAX_LEN}자까지 쓸 수 있어요.
          </p>
        </div>

        <div className={MODAL_ACTIONS}>
          <button type="button" className={BTN_SECONDARY} onClick={onCancel}>
            취소
          </button>
          <button type="submit" className={BTN} disabled={!canSave}>
            저장
          </button>
        </div>
      </form>
    </Modal>
  )
}
