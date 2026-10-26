import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Modal from './Modal'
import type { Challenge, UserProfile } from '../../types'
import { inviteToChallenge, friendlyErrorMessage } from '../../firebase'
import { useAppUI } from '../../contexts/AppUIContext'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[480px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const BTN =
  'bg-ink text-bg border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'invite-challenge-modal-title'

/** 이름이 비어 있으면 이메일 앞부분. 친구 목록·알림함과 같은 규칙. */
function friendName(f: UserProfile): string {
  return f.displayName?.trim() || f.email?.split('@')[0] || '이름 없는 친구'
}

interface Props {
  challenge: Challenge
  friends: UserProfile[]
  onClose: () => void
  onInvited: () => void
}

export default function InviteToChallengeModal({ challenge, friends, onClose, onInvited }: Props) {
  const { showToast } = useAppUI()
  const [picked, setPicked] = useState<string[]>([])

  // 이미 들어왔거나 부른 사람은 고를 수 없다. 서버도 막지만, 목록에 띄워두면 눌러보게 된다.
  const taken = new Set([...challenge.members.map((m) => m.uid), ...(challenge.invited ?? []).map((m) => m.uid)])
  const candidates = friends.filter((f) => !taken.has(f.uid))

  const invite = useMutation({
    // 한 명씩 부르는 콜러블이라 고른 수만큼 보낸다. 한 명이 실패하면 거기서 멈춘다 —
    // 나머지를 밀어붙이면 어디까지 들어갔는지 알 수 없게 된다.
    mutationFn: async () => {
      for (const uid of picked) await inviteToChallenge(challenge.id, uid)
    },
    onSuccess: () => {
      showToast(picked.length > 1 ? `${picked.length}명을 불렀어요` : '친구를 불렀어요', 'success')
      onInvited()
    },
    onError: (err) => showToast(friendlyErrorMessage(err, '부르지 못했어요. 다시 시도해주세요'), 'error'),
  })

  const toggle = (uid: string) => setPicked((v) => (v.includes(uid) ? v.filter((x) => x !== uid) : [...v, uid]))

  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-medium">
            친구 부르기
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          {candidates.length === 0 ? (
            <p className="text-xs sm:text-[13px] text-dim">
              {friends.length === 0
                ? '아직 친구가 없어요. 친구 탭에서 먼저 친구를 추가해주세요.'
                : '친구를 모두 불렀어요.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {candidates.map((f) => {
                const on = picked.includes(f.uid)
                return (
                  <button
                    key={f.uid}
                    onClick={() => toggle(f.uid)}
                    className={`text-left flex items-center gap-2.5 bg-surface2 rounded-lg p-2.5 cursor-pointer border ${
                      on ? 'border-accent' : 'border-border hover:border-accent'
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
                    {on && <span className="flex-shrink-0 text-[13px] text-accent">선택됨</span>}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-3.5">
            <button className={BTN_SECONDARY} onClick={onClose}>
              취소
            </button>
            <button className={BTN} disabled={picked.length === 0 || invite.isPending} onClick={() => invite.mutate()}>
              {invite.isPending ? '부르는 중…' : '부르기'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
