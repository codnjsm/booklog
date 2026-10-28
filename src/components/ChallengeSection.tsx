import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import type { Challenge, ChallengeMember, UserProfile } from '../types'
import { listChallenges, joinChallenge, declineChallenge, deleteChallenge, leaveChallenge } from '../firebase'
import { useAppUI } from '../contexts/AppUIContext'
import { daysUntil } from '../lib/day'
import InviteToChallengeModal from './modals/InviteToChallengeModal'

const LABEL = 'font-mono text-[10px] sm:text-[12px] tracking-[0.09em] text-dim'
/** 카드 껍데기. 한 챌린지가 카드 하나이고 그 안에 달성률·참여자가 나뉘어 들어간다. */
const CARD_BASE = 'bg-surface border rounded-[10px] overflow-hidden flex flex-col'
const CARD = `${CARD_BASE} border-border`
/**
 * 완주한 카드.
 *
 * `CARD`에 `border-accent`를 덧붙이면 안 된다 — Tailwind는 border-color 유틸을 알파벳 순으로
 * 내보내서 `.border-border`가 `.border-accent`보다 **뒤에** 온다. 둘 다 클래스 하나라
 * 특이도가 같으니 나중 것이 이긴다. 그래서 색을 더하지 않고 통째로 갈아끼운다.
 */
const CARD_DONE = `${CARD_BASE} border-accent`
/** 카드 안쪽 여백. 줄 단위로 선을 그어야 해서 껍데기와 따로 둔다. */
const PAD = 'py-3.5 px-4 sm:py-[18px] sm:px-5'
/**
 * 목표를 채웠다는 뱃지. 「완료는 accent로 채운다」는 규칙 — 역할 표시인 「만든 사람」 회색 뱃지와
 * 무게가 갈려야 한다. 글자는 홈 요약(`HomeTab`)과 같은 「목표 달성」으로 맞춘다 —
 * 홈에서 본 말과 들어와서 보는 말이 다르면 다른 상태로 읽힌다.
 */
const CHIP_DONE = 'flex-shrink-0 text-[11px] font-medium text-white bg-accentfill rounded px-1.5 py-0.5'
/** 역할·상태 표시. 해낸 것이 아니라 사실이라 중립색으로 둔다. */
const CHIP_QUIET = 'flex-shrink-0 text-[11px] text-dim bg-surface2 rounded px-1.5 py-0.5'
// 초대를 받아들이는 쪽이 주 버튼이다. 둘 다 연한 채움이면 어느 쪽이 기본인지 읽히지 않는다.
const BTN_OK =
  'bg-accentfill text-white border-none font-medium px-3.5 py-2 rounded-lg text-[13px] cursor-pointer transition-all duration-150 hover:bg-accentfillhover disabled:opacity-50'
// 거절은 아무것도 지우지 않는다. danger는 되돌릴 수 없는 것에만 쓴다.
const BTN_NO =
  'bg-surface text-dim border border-border font-medium px-3.5 py-2 rounded-lg text-[13px] cursor-pointer transition-all duration-150 hover:text-ink disabled:opacity-50'
/** 카드 구석의 파괴적 액션(지우기·나가기). 눌러야 할 것보다 앞설 이유가 없어 고스트로 둔다. */
const BTN_GHOST =
  'bg-transparent border-none text-dim font-medium px-1 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors duration-150 hover:text-danger'

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
  // 기간이 끝나기를 기다리지 않는다 — 서버가 목록을 내려줄 때마다 `days >= goalDays`로 다시 센다.
  // 기간 중에 목표를 채우면 그 자리에서 켜진다. 남의 줄(`m.achieved`)도 같은 값이다.
  // 기간이 끝난 뒤 도는 정산(`settleChallenge`)은 이 값을 읽어 영구 뱃지를 남기는 별개의 일이다.
  const achieved = me?.achieved ?? false
  // 「2일 더 기록하면 완주예요」만으로는 여유가 있는지 이미 늦었는지 알 수 없다.
  // 남은 날을 같이 보여줘야 뜻이 생긴다. 서버의 끝남 판정은 서울 기준이라
  // 기기 시간대가 다르면 하루 어긋날 수 있어, 0 이하면 아무것도 쓰지 않는다.
  const remaining = daysUntil(c.to)
  const period = c.ended ? ' · 끝남' : remaining === 1 ? ' · 오늘까지' : remaining > 1 ? ` · ${remaining}일 남음` : ''
  return (
    <div className={PAD}>
      {/* 지우기는 만든 사람에게만 보인다. 결과가 크므로(참여한 사람들에게서 모두 사라진다)
          confirm을 거치고, 손을 올리면 빨갛게 된다. 평소에는 고스트로 두어 완주 뱃지보다 앞서지 않는다.
          음수 마진은 버튼 상하 여백만큼 줄이 벌어지는 걸 막는다 — 누를 수 있는 넓이는 그대로다. */}
      <div className="flex items-center gap-2">
        <span className={LABEL}>
          {short(c.from)} ~ {short(c.to)}
          {period}
        </span>
        {/* 이 뱃지가 남의 줄에만 있고 내 카드엔 없었다. 정작 내가 채웠는지가 제일 중요한데. */}
        {achieved && <span className={CHIP_DONE}>목표 달성</span>}
        {(onDelete || onLeave) && <span className="flex-1" />}
        {/* 만든 사람은 지우고, 참여자는 나간다. 만든 사람이 나가면 아무도 못 지우는 문서가 되므로
            둘이 같이 뜨는 일은 없다. 같은 자리에 하나만 오므로 모양도 같게 둔다. */}
        {onLeave && (
          <button type="button" onClick={onLeave} className={`${BTN_GHOST} flex-shrink-0 -my-1`}>
            나가기
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className={`${BTN_GHOST} flex-shrink-0 -my-1`}>
            지우기
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mt-2.5">
        <span className="text-[28px] sm:text-[34px] font-bold text-accent leading-none">{days}</span>
        <span className="text-sm text-dim">/ {c.goalDays}일</span>
        <span className="flex-1" />
        <span className={`text-[13px] ${achieved ? 'font-medium text-accent' : 'text-dim'}`}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface2 mt-3 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      {/* 목표를 채운 줄은 흐린 회색으로 두면 그냥 지나친다. 색과 굵기로 세운다. */}
      <div className={`text-xs sm:text-[13px] mt-2.5 text-right ${achieved ? 'font-medium text-accent' : 'text-dim'}`}>
        {achieved ? '완주했어요 🎉' : c.ended ? `${days}일 기록했어요` : `${left}일 더 기록하면 완주예요`}
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

  // 선을 카드 끝까지 긋지 않고 글자 선에 맞춘다. 그래서 좌우 여백을 안쪽 패딩이 아니라
  // 바깥 마진으로 준다 — 패딩으로 주면 테두리가 카드 폭 전체를 가로지른다.
  // 달성률 영역(px-4/sm:px-5)보다 5px 더 들어온다. 참여자는 그 아래 딸린 부분이라
  // 한 칸 들여써서 묶음을 드러낸다. 선도 같이 들어온다.
  const ROW = 'flex items-center gap-2.5 mx-[21px] sm:mx-[25px] py-3 border-0 border-t border-border'
  return (
    // 같은 카드 안에서 달성률 아래에 이어 붙는다. 줄의 아래 여백(12px)만으로는
    // 카드 위쪽(14px, 데스크톱 18px)보다 좁아 보여서 바닥을 그만큼 채운다.
    // flex-col이라야 안의 버튼이 줄과 같은 폭으로 늘어난다.
    <div className="flex flex-col pb-0.5 sm:pb-1.5">
      {/* 여기엔 선을 긋지 않는다 — 달성률과는 여백으로 갈리고, 선은 사람 줄 사이에만 쓴다. */}
      <div className="mx-[21px] sm:mx-[25px] pt-3.5 pb-2 flex items-baseline gap-2">
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
          {m.uid === c.ownerUid && <span className={CHIP_QUIET}>만든 사람</span>}
          {m.achieved && <span className={CHIP_DONE}>목표 달성</span>}
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
          <span className={CHIP_QUIET}>수락 기다리는 중</span>
        </div>
      ))}

      {onInvite && (
        <button
          type="button"
          onClick={onInvite}
          // w-full을 주면 좌우 마진만큼(16px) 카드 밖으로 넘쳐 구분선이 오른쪽 끝에 붙는다.
          // 버튼은 div와 달리 저절로 안 늘어나므로, 카드를 세로 flex로 두어 늘린다.
          className={`${ROW} text-left bg-transparent cursor-pointer text-[13px] text-accent hover:bg-surface2`}
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
    <div className="flex flex-col gap-4">
      {/* 참여 중인 카드와 같은 그릇을 쓰고, 어느 쪽인지는 라벨로 가른다 —
          한 화면에 흰 카드·회색 카드가 섞여 있으면 재질이 두 번 바뀌어 읽기 어렵다. */}
      {invited.map((c) => {
        // 수락할지 말지는 남은 기간을 봐야 정한다. 참여 카드와 같은 규칙으로 센다.
        const remaining = daysUntil(c.to)
        const period = remaining === 1 ? ' · 오늘까지' : remaining > 1 ? ` · ${remaining}일 남음` : ''
        return (
          <div key={c.id} className={`${CARD} ${PAD} gap-2`}>
            <span className={LABEL}>초대받음</span>
            <span className="text-[13px] text-ink">
              <span className="font-semibold">
                {c.members.find((m) => m.uid === c.ownerUid)?.displayName || '친구'}
              </span>
              님이 챌린지에 초대했어요
            </span>
            <span className="text-xs text-dim">
              {short(c.from)} ~ {short(c.to)}
              {period} · 목표 {c.goalDays}일 · {c.members.length}명 참여 중
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
        )
      })}

      {/* 한 챌린지가 카드 하나다. 달성률과 참여자가 따로 떠 있으면 어디까지가 한 챌린지인지
          읽히지 않아서, 카드 테두리가 그 경계를 맡는다. */}
      {joined.map((c) => {
        const me = c.members.find((m) => m.uid === user.uid)
        return (
          // 완주한 카드는 테두리를 accent로 바꾼다. 뱃지와 한 줄짜리 문구만으로는
          // 여러 장이 쌓였을 때 어느 게 끝까지 간 건지 훑어서 알 수 없다.
          <div key={c.id} className={me?.achieved ? CARD_DONE : CARD}>
            <MyProgress
              c={c}
              me={me}
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
        )
      })}

      {/* 피드 빈 상태와 같은 모양 — 만들기 버튼은 제목줄에 있으므로 여기 두 번 두지 않는다. */}
      {joined.length === 0 && (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">진행 중인 챌린지가 없어요</h3>
          {/* 참여자 목록을 일부러 등수로 세우지 않는데 여기서만 「겨뤄보세요」라고 하면 말이 어긋난다. */}
          <p className="text-xs sm:text-[13px]">친구들과 기간을 정해 함께 기록해보세요</p>
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
    </div>
  )
}
