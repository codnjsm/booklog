import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import type { Challenge, ChallengeMember, UserProfile } from '../types'
import { listChallenges, joinChallenge, declineChallenge, deleteChallenge, leaveChallenge } from '../firebase'
import { useAppUI } from '../contexts/AppUIContext'
import CreateChallengeModal from './modals/CreateChallengeModal'
import InviteToChallengeModal from './modals/InviteToChallengeModal'

const LABEL = 'font-mono text-[10px] sm:text-[12px] tracking-[0.09em] text-dim'
const CARD = 'bg-surface border border-border rounded-[10px] py-3.5 px-4 sm:py-[18px] sm:px-5'
// 친구 요청의 수락·거절과 같은 규격. 카드 배경이 중립(surface2)이라 연한 채움이 또렷하게 보인다.
const BTN_OK =
  'bg-accentsoft text-accent border-none font-medium px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-all duration-150 hover:opacity-80 disabled:opacity-50'
const BTN_NO =
  'bg-dangersoft text-danger border-none font-medium px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-all duration-150 hover:opacity-80 disabled:opacity-50'
// 책 상세의 「+ 문장 저장」과 같은 규격 — 앱에서 「이걸 누르세요」를 뜻하는 모양.
const BTN_PRIMARY =
  'text-[13px] sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-accentfill text-white border-none cursor-pointer hover:bg-accentfillhover'

/** 2026-10-01 → 10.01 */
function short(day: string): string {
  return day.slice(5).replace('-', '.')
}

function Avatar({ url, name }: { url?: string; name: string }) {
  if (url)
    return (
      <img
        loading="lazy"
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
        src={url}
        referrerPolicy="no-referrer"
        alt=""
      />
    )
  return (
    <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-accentfill text-white font-semibold text-xs">
      {(name || '?')[0].toUpperCase()}
    </span>
  )
}

/**
 * 내 달성률 — 주 지표.
 *
 * 등수가 아니라 **내 목표 대비 얼마**를 맨 위에 크게 둔다.
 * 「3등」이라고 쓰면 3등은 그만둔다.
 */
function MyProgress({
  c,
  me,
  onDelete,
  onLeave,
}: {
  c: Challenge
  me?: ChallengeMember
  onDelete?: () => void
  onLeave?: () => void
}) {
  const days = me?.days ?? 0
  const pct = Math.min(100, Math.round((days / c.goalDays) * 100))
  const left = c.goalDays - days
  return (
    <div className={CARD}>
      {/* 지우기는 만든 사람에게만 보인다. 댓글 삭제와 같은 × 모양이되,
          결과가 더 크므로(참여자 모두에게서 사라진다) confirm을 거치고 올리면 빨갛게 된다.
          음수 마진으로 카드가 ×만큼 높아지지 않게 하고, 터치 영역은 24×24를 지킨다. */}
      <div className="flex items-center gap-2">
        <span className={LABEL}>
          {short(c.from)} ~ {short(c.to)}
          {c.ended ? ' · 끝남' : ''}
        </span>
        {(onDelete || onLeave) && <span className="flex-1" />}
        {/* 만든 사람은 지우고, 참여자는 나간다. 만든 사람이 나가면 아무도 못 지우는 문서가 되므로
            둘이 같이 뜨는 일은 없다. 같은 자리에 하나만 오므로 모양도 같게 둔다. */}
        {onLeave && (
          <button type="button" onClick={onLeave} className={`${BTN_NO} flex-shrink-0 -my-1`}>
            나가기
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className={`${BTN_NO} flex-shrink-0 -my-1`}>
            지우기
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mt-2.5">
        <span className="text-[28px] sm:text-[34px] font-bold text-accent leading-none">{days}</span>
        <span className="text-sm text-dim">/ {c.goalDays}일</span>
        <span className="flex-1" />
        <span className="text-[13px] text-dim">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface2 mt-3 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs sm:text-[13px] text-dim mt-2.5">
        {left <= 0 ? '목표를 채웠어요' : c.ended ? `${days}일 기록했어요` : `${left}일 더 기록하면 완주예요`}
      </div>
    </div>
  )
}

/**
 * 함께하는 사람 — 보조 지표.
 * **정렬하지 않는다.** 날짜 수로 줄을 세우면 그게 곧 등수다.
 */
function Members({ c, myUid, onInvite }: { c: Challenge; myUid: string; onInvite?: () => void }) {
  const others = c.members.filter((m) => m.uid !== myUid)
  // 서버가 이 필드를 내려주기 전 버전이면 없다. 없으면 빈 목록으로 둔다 —
  // 여기서 터지면 기록 탭 전체가 흰 화면이 된다.
  const waiting = c.invited ?? []
  // 부를 수 있는 사람이 없고 아무도 없으면 카드를 아예 두지 않는다.
  if (others.length === 0 && waiting.length === 0 && !onInvite) return null

  const ROW = 'flex items-center gap-2.5 px-4 py-3 border-0 border-t border-border'
  return (
    <div className="bg-surface border border-border rounded-[10px]">
      {/* 내가 만든 챌린지면 그렇다고 적는다 — 부르기·지우기 버튼이 나에게만 보이는 이유다. */}
      <div className="px-4 pt-3.5 pb-2 flex items-baseline gap-2">
        <span className={LABEL}>{others.length > 0 ? `함께하는 사람 ${others.length}` : '아직 혼자예요'}</span>
        {c.ownerUid === myUid && (
          <>
            <span className="flex-1" />
            <span className={LABEL}>내가 만든 챌린지</span>
          </>
        )}
      </div>

      {others.map((m) => (
        <div key={m.uid} className={ROW}>
          <Avatar url={m.photoURL} name={m.displayName} />
          <span className="flex-1 min-w-0 text-[13px] text-ink truncate">{m.displayName || '이름 없음'}</span>
          {/* 「만든 사람」은 역할 표시라 중립색으로 둔다. accent는 완주처럼 해낸 것에만 쓴다.
              이게 없으면 참여자는 자기에게 왜 부르기 버튼이 없는지 알 수 없다. */}
          {m.uid === c.ownerUid && (
            <span className="text-[11px] text-dim bg-surface2 rounded px-1.5 py-0.5 flex-shrink-0">만든 사람</span>
          )}
          {m.achieved && (
            <span className="text-[11px] text-accent bg-accentsoft rounded px-1.5 py-0.5 flex-shrink-0">완주</span>
          )}
          <span className="font-mono text-[13px] text-dim flex-shrink-0">{m.days}일</span>
        </div>
      ))}

      {/* 불렀는데 아직 안 들어온 사람. 이게 없으면 초대를 보냈는지조차 확인할 길이 없다.
          아바타를 흐리게 둬서 참여자 줄과 한눈에 갈린다. */}
      {waiting.map((m) => (
        <div key={m.uid} className={ROW}>
          <span className="opacity-45">
            <Avatar url={m.photoURL} name={m.displayName} />
          </span>
          <span className="flex-1 min-w-0 text-[13px] text-dim truncate">{m.displayName || '이름 없음'}</span>
          <span className="text-[11px] text-dim bg-surface2 rounded px-1.5 py-0.5 flex-shrink-0">수락 기다리는 중</span>
        </div>
      ))}

      {onInvite && (
        <button
          type="button"
          onClick={onInvite}
          className={`${ROW} w-full text-left bg-transparent cursor-pointer text-[13px] text-accent hover:bg-surface2`}
        >
          + 친구 부르기
        </button>
      )}
    </div>
  )
}

interface Props {
  user: User | null
  friends: UserProfile[]
}

export default function ChallengeSection({ user, friends }: Props) {
  const { showToast } = useAppUI()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  // 어느 챌린지에 부를지 담아둔다. null이면 모달이 닫힌 상태다.
  const [inviting, setInviting] = useState<Challenge | null>(null)

  const query = useQuery({
    queryKey: ['challenges'],
    queryFn: listChallenges,
    enabled: !!user,
    staleTime: 30_000,
  })
  const joined = query.data?.joined ?? []
  const invited = query.data?.invited ?? []

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? joinChallenge(id) : declineChallenge(id),
    onSuccess: (_d, { accept }) => {
      showToast(accept ? '챌린지에 참여했어요' : '초대를 지웠어요', 'success')
      void queryClient.invalidateQueries({ queryKey: ['challenges'] })
    },
    onError: () => showToast('처리하지 못했어요', 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteChallenge(id),
    onSuccess: () => {
      showToast('챌린지를 지웠어요', 'success')
      void queryClient.invalidateQueries({ queryKey: ['challenges'] })
    },
    onError: () => showToast('지우지 못했어요', 'error'),
  })

  const leave = useMutation({
    mutationFn: (id: string) => leaveChallenge(id),
    onSuccess: () => {
      showToast('챌린지에서 나왔어요', 'success')
      void queryClient.invalidateQueries({ queryKey: ['challenges'] })
    },
    onError: () => showToast('나오지 못했어요', 'error'),
  })

  if (!user) return null

  return (
    <div className="flex flex-col gap-3">
      {/* 참여 중인 게 있어도 새로 만들 수 있다 — 서버는 원래 허용하는데 버튼이 빈 상태 카드 안에만
          있어서 막혀 있었다. 기록 하나가 참여 중인 모든 챌린지에 함께 반영되므로 겹쳐도 부담이 없다.
          빈 상태일 때는 카드 가운데 큰 버튼이 있으므로 여기 두 번 두지 않는다.
          제목은 세그먼트의 「챌린지」가 이미 말하고 있어서 따로 적지 않는다.
          좌우 8px은 아래 카드들과 눈으로 맞춘 값이다. */}
      {joined.length > 0 && (
        <div className="flex justify-end px-2">
          <button type="button" onClick={() => setCreating(true)} className={BTN_OK}>
            + 만들기
          </button>
        </div>
      )}

      {/* 받은 초대. 배경을 중립으로 둬서 연한 채움 버튼 둘이 또렷하게 보인다. */}
      {invited.map((c) => (
        <div key={c.id} className="px-4 py-3.5 bg-surface2 rounded-[10px] flex flex-col gap-2">
          <span className="text-[13px] text-ink">
            <span className="font-semibold">{c.members.find((m) => m.uid === c.ownerUid)?.displayName || '친구'}</span>
            님이 챌린지에 초대했어요
          </span>
          <span className="text-xs text-dim">
            {short(c.from)} ~ {short(c.to)} · 목표 {c.goalDays}일 · {c.members.length}명 참여 중
          </span>
          <div className="flex gap-1.5 justify-end">
            <button
              className={BTN_NO}
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: c.id, accept: false })}
            >
              안 할래요
            </button>
            <button
              className={BTN_OK}
              disabled={respond.isPending}
              onClick={() => respond.mutate({ id: c.id, accept: true })}
            >
              참여하기
            </button>
          </div>
        </div>
      ))}

      {joined.map((c) => (
        <div key={c.id} className="flex flex-col gap-3">
          <MyProgress
            c={c}
            me={c.members.find((m) => m.uid === user.uid)}
            onDelete={
              c.ownerUid === user.uid
                ? () => {
                    if (confirm('이 챌린지를 지울까요?\n참여한 사람들에게서도 사라져요.')) remove.mutate(c.id)
                  }
                : undefined
            }
            onLeave={
              c.ownerUid !== user.uid
                ? () => {
                    if (confirm('이 챌린지에서 나갈까요?\n다시 들어오려면 만든 사람이 다시 불러야 해요.'))
                      leave.mutate(c.id)
                  }
                : undefined
            }
          />
          {/* 부르기는 방장만, 끝나지 않은 챌린지에만. 서버도 같은 조건으로 막는다. */}
          <Members
            c={c}
            myUid={user.uid}
            onInvite={c.ownerUid === user.uid && !c.ended ? () => setInviting(c) : undefined}
          />
        </div>
      ))}

      {joined.length === 0 && (
        <div className="text-center py-10 px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">진행 중인 챌린지가 없어요</h3>
          <p className="text-xs sm:text-[13px] mb-3.5">친구들과 한 달 동안 며칠 기록할지 정해보세요</p>
          <button className={BTN_PRIMARY} onClick={() => setCreating(true)}>
            + 챌린지 만들기
          </button>
        </div>
      )}

      {inviting && (
        <InviteToChallengeModal
          challenge={inviting}
          friends={friends}
          onClose={() => setInviting(null)}
          onInvited={() => {
            setInviting(null)
            void queryClient.invalidateQueries({ queryKey: ['challenges'] })
          }}
        />
      )}

      {creating && (
        <CreateChallengeModal
          friends={friends}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void queryClient.invalidateQueries({ queryKey: ['challenges'] })
          }}
        />
      )}
    </div>
  )
}
