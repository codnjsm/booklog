import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import { listChallenges } from '../firebase'
import type { Challenge } from '../types'

export type ChallengeList = { joined: Challenge[]; invited: Challenge[] }

/**
 * 마지막으로 받아온 챌린지를 남겨두는 자리.
 *
 * `useData`의 소유자 표시와 같은 이유로 uid를 같이 저장한다 — 한 브라우저를 둘이 쓰면
 * 앞사람의 챌린지가 뒷사람 홈에 잠깐 보인다.
 */
const CACHE_KEY = 'reading-notes-challenges-v1'

interface Cached {
  uid: string
  /** 서버에서 받아온 시각. React Query에 그대로 넘겨 「언제 받은 것인지」를 알린다. */
  savedAt: number
  data: ChallengeList
}

export function readCache(uid: string): Cached | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return undefined
    const c = JSON.parse(raw) as Cached
    return c?.uid === uid && c.data ? c : undefined
  } catch {
    // 모양이 바뀌었거나 읽을 수 없으면 캐시 없이 간다. 어차피 곧 서버에서 받는다.
    return undefined
  }
}

export function writeCache(uid: string, savedAt: number, data: ChallengeList) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, savedAt, data } satisfies Cached))
  } catch {
    // 저장 공간이 찼거나 막힌 브라우저. 캐시는 있으면 좋은 것이지 없으면 안 되는 게 아니다.
  }
}

/** 회원 탈퇴처럼 이 브라우저의 기록을 완전히 지울 때 쓴다. */
export function clearChallengeCache() {
  localStorage.removeItem(CACHE_KEY)
}

/**
 * 챌린지 목록. 홈 요약과 친구 탭이 같은 걸 쓴다.
 *
 * 서버가 참여자 전원의 독서 기록을 통째로 읽어 날짜를 세기 때문에(`countRecordedDays`)
 * 이 호출은 느리다. 홈의 다른 영역은 전부 로컬스토리지라 즉시 뜨는데 챌린지만
 * 뒤늦게 튀어나왔다. 그래서 지난번 결과를 먼저 그리고 뒤에서 조용히 갱신한다.
 */
export function useChallenges(user: User | null) {
  const cached = useMemo(() => (user ? readCache(user.uid) : undefined), [user])

  const query = useQuery({
    queryKey: ['challenges'],
    queryFn: listChallenges,
    enabled: !!user,
    staleTime: 30_000,
    initialData: cached?.data,
    // 받아온 시각을 같이 넘겨야 한다. 안 넘기면 React Query가 지금 받은 것으로 쳐서
    // staleTime 동안 갱신을 건너뛴다 — 어제 것을 오늘 내내 보여주게 된다.
    initialDataUpdatedAt: cached?.savedAt,
  })

  const { data, dataUpdatedAt } = query
  useEffect(() => {
    // 받아온 시각을 그대로 적는다. 여기서 Date.now()를 쓰면 화면을 열 때마다 시각이 새로 찍혀
    // 실제로는 오래된 데이터가 계속 신선한 것으로 보인다.
    if (user && data) writeCache(user.uid, dataUpdatedAt, data)
  }, [user, data, dataUpdatedAt])

  return query
}
