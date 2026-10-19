/**
 * 날짜(YYYY-MM-DD) 다루기.
 *
 * 시각은 UTC(`toISOString`)로 저장한다 — 기기 시간대가 달라도 값이 흔들리지 않는 올바른 방식이다.
 * 문제는 꺼내 쓸 때다. 앞 10자를 그냥 자르면 **UTC 날짜**가 나와서,
 * 한국에서 새벽(자정~오전 9시)에 남긴 기록이 전날로 잡힌다.
 *
 * 그래서 날짜로 바꿀 때는 **기기 시간 기준**으로 옮긴다. 달력이 원래 쓰던 방식이고,
 * 사용자가 화면에서 보는 날짜와도 같다.
 */

/** Date → 그 기기에서 본 YYYY-MM-DD. */
export function toDayString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 저장된 값 → 날짜.
 *
 * 이미 날짜만 있는 값(달력에서 고른 읽은 날)은 그대로 둔다 —
 * 시각이 없는 문자열을 Date로 돌리면 UTC 자정으로 읽혀서 시간대에 따라 하루가 밀린다.
 */
export function isoToDay(value: string): string {
  if (value.length === 10) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : toDayString(d)
}

/** 오늘 (기기 시간 기준). */
export function today(now: Date = new Date()): string {
  return toDayString(now)
}
