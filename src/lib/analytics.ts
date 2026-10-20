/**
 * 유입 측정.
 *
 * 어디서 몇 명이 들어왔는지 모르면 글을 열 번 고쳐 올려도 뭐가 나았는지 알 수 없다.
 * 주소 뒤에 `?utm_source=cafe` 를 붙여 공유하면 그 꼬리표로 채널을 가른다.
 *
 * **기록하는 건 유입 경로뿐이다.** 무슨 책을 읽었는지, 무슨 문장을 담았는지는 보내지 않는다.
 */

/** utm 꼬리표가 없을 때의 값. 주소를 직접 치거나 북마크로 들어온 경우다. */
export const DIRECT = 'direct'

export interface Visit {
  /** 어디서 왔나 — cafe, blog, instagram 같은 우리가 정한 이름 */
  source: string
  /** 어떤 형태였나 — post, profile 같은 것. 안 붙였으면 없다 */
  medium?: string
  /** 어느 글이었나 — 같은 카페에 글을 여러 번 올릴 때 가른다 */
  campaign?: string
}

/**
 * 꼬리표 값이 너무 길거나 이상하면 버린다. 주소는 누구나 고칠 수 있다.
 *
 * 긴 값을 잘라서 쓰지 않고 통째로 버리는 이유 — 잘라 쓰면 없는 채널이 하나 생겨
 * 집계가 더러워진다. 우리가 붙인 꼬리표는 전부 짧다.
 */
function clean(value: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 40) return undefined
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) ? trimmed.toLowerCase() : undefined
}

/**
 * 주소에서 유입 경로를 읽는다.
 *
 * `utm_source`가 없으면 `direct`다 — "아무도 안 왔다"와 "꼬리표 없이 왔다"는 다르므로
 * null이 아니라 값으로 남긴다.
 */
export function readVisit(search: string): Visit {
  const p = new URLSearchParams(search)
  return {
    source: clean(p.get('utm_source')) ?? DIRECT,
    medium: clean(p.get('utm_medium')),
    campaign: clean(p.get('utm_campaign')),
  }
}

/** 같은 방문 안에서 여러 번 세지 않도록 남기는 표시. 탭을 닫으면 사라진다. */
const SESSION_KEY = 'reading-notes-visit-sent-v1'

/** 이번 방문에서 이미 보냈는지. 새로고침해도 한 번만 센다. */
export function alreadySent(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드)에서는 중복을 감수하고 보낸다 — 아예 안 세는 것보다 낫다.
    return false
  }
}

export function markSent(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* 못 남겨도 이번 화면에서는 보낸 것으로 친다 */
  }
}
