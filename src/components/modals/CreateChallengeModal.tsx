import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Modal from './Modal'
import type { UserProfile } from '../../types'
import { createChallenge, friendlyErrorMessage } from '../../firebase'
import { useAppUI } from '../../contexts/AppUIContext'
import { today } from '../../lib/day'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[480px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const FORM_LABEL = 'flex text-xs sm:text-[13px] mb-1.5 text-dim'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans'
const BTN =
  'bg-ink text-bg border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'create-challenge-modal-title'

/** 이름이 비어 있으면 이메일 앞부분. 친구 목록·알림함과 같은 규칙. */
function friendName(f: UserProfile): string {
  return f.displayName?.trim() || f.email?.split('@')[0] || '이름 없는 친구'
}

/** 이번 달의 남은 기간. 달 중간에 시작하면 오늘부터 말일까지다. */
function thisMonth(now = new Date()) {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { from: today(now), to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}` }
}

/** 양끝을 포함한 날 수. */
function spanDays(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
}

interface Props {
  friends: UserProfile[]
  onClose: () => void
  onCreated: () => void
}

export default function CreateChallengeModal({ friends, onClose, onCreated }: Props) {
  const { showToast } = useAppUI()
  const { from, to } = thisMonth()
  const span = spanDays(from, to)
  // 기본값은 기간의 절반. 처음부터 높게 잡으면 시작도 전에 포기한다.
  const [goalDays, setGoalDays] = useState(() => Math.max(1, Math.round(span / 2)))
  const [invite, setInvite] = useState<string[]>([])

  const create = useMutation({
    mutationFn: () => createChallenge({ from, to, goalDays, invite }),
    onSuccess: () => {
      showToast('챌린지를 만들었어요', 'success')
      onCreated()
    },
    onError: (err) => showToast(friendlyErrorMessage(err, '만들지 못했어요. 다시 시도해주세요'), 'error'),
  })

  const toggle = (uid: string) => setInvite((v) => (v.includes(uid) ? v.filter((x) => x !== uid) : [...v, uid]))
  const valid = goalDays >= 1 && goalDays <= span

  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-medium">
            챌린지 만들기
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          <div className="px-4 py-3 bg-surface2 rounded-lg mb-3.5">
            <div className="text-[13px] text-ink">
              {from.slice(5).replace('-', '.')} ~ {to.slice(5).replace('-', '.')}
            </div>
            <div className="text-xs text-dim mt-1">이번 달 남은 {span}일 동안 겨뤄요</div>
          </div>

          <label className={FORM_LABEL} htmlFor="challenge-goal">
            며칠 기록하면 완주일까요
          </label>
          <input
            id="challenge-goal"
            type="number"
            inputMode="numeric"
            min={1}
            max={span}
            value={goalDays}
            onChange={(e) => setGoalDays(Number(e.target.value))}
            className={FORM_INPUT}
          />
          {!valid && <p className="text-xs text-danger mt-1.5">1일에서 {span}일 사이로 정해주세요</p>}

          <div className={`${FORM_LABEL} mt-3.5`}>누구와 함께할까요</div>
          {friends.length === 0 ? (
            <p className="text-xs sm:text-[13px] text-dim">아직 친구가 없어요. 혼자 시작하고 나중에 불러도 괜찮아요.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {friends.map((f) => {
                const picked = invite.includes(f.uid)
                return (
                  <button
                    key={f.uid}
                    onClick={() => toggle(f.uid)}
                    className={`text-left flex items-center gap-2.5 bg-surface2 rounded-lg p-2.5 cursor-pointer border ${
                      picked ? 'border-accent' : 'border-border hover:border-accent'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-full bg-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {f.photoURL ? (
                        <img src={f.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] text-dim">{friendName(f).slice(0, 1)}</span>
                      )}
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] text-ink truncate">{friendName(f)}</span>
                    {picked && <span className="flex-shrink-0 text-[13px] text-accent">선택됨</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-3.5">
            <button className={BTN_SECONDARY} onClick={onClose}>
              취소
            </button>
            <button className={BTN} disabled={!valid || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? '만드는 중…' : '만들기'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
