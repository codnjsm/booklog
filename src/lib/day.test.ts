import { describe, it, expect } from 'vitest'
import { toDayString, isoToDay, today, dayAfter, endOfMonth } from './day'

describe('isoToDay — 저장된 값을 날짜로', () => {
  it('날짜만 있는 값은 그대로 둔다 — 달력에서 고른 읽은 날', () => {
    expect(isoToDay('2026-10-05')).toBe('2026-10-05')
  })

  it('시각이 있는 값은 기기 시간 기준 날짜로 바꾼다', () => {
    // 이 기기(한국)에서 2026-10-06 08:00은 UTC로 2026-10-05 23:00이다.
    // 그냥 잘랐다면 10-05가 나왔을 값이다.
    const iso = new Date(2026, 9, 6, 8, 0, 0).toISOString()
    expect(isoToDay(iso)).toBe('2026-10-06')
  })

  it('자정 직후 기록도 그날로 잡힌다 — 전날로 밀리면 안 된다', () => {
    const iso = new Date(2026, 9, 6, 0, 30, 0).toISOString()
    expect(isoToDay(iso)).toBe('2026-10-06')
  })

  it('밤늦은 기록도 그날로 잡힌다', () => {
    const iso = new Date(2026, 9, 6, 23, 30, 0).toISOString()
    expect(isoToDay(iso)).toBe('2026-10-06')
  })

  it('값이 깨져 있으면 빈 문자열 — 앱이 멈추면 안 된다', () => {
    expect(isoToDay('날짜아님입니다')).toBe('')
  })
})

describe('toDayString / today', () => {
  it('두 자리로 채운다', () => {
    expect(toDayString(new Date(2026, 0, 3))).toBe('2026-01-03')
  })

  it('오늘은 기기 시간 기준', () => {
    const now = new Date(2026, 9, 6, 1, 0, 0)
    expect(today(now)).toBe('2026-10-06')
  })
})

describe('dayAfter — 오늘로부터 n일 뒤', () => {
  it('같은 달 안에서 더한다', () => {
    expect(dayAfter(6, new Date(2026, 9, 22))).toBe('2026-10-28')
  })

  it('0이면 오늘', () => {
    expect(dayAfter(0, new Date(2026, 9, 22))).toBe('2026-10-22')
  })

  it('달을 넘긴다', () => {
    expect(dayAfter(29, new Date(2026, 9, 22))).toBe('2026-11-20')
  })

  it('해를 넘긴다', () => {
    expect(dayAfter(13, new Date(2026, 11, 25))).toBe('2027-01-07')
  })

  it('윤년 2월을 지난다', () => {
    expect(dayAfter(3, new Date(2028, 1, 27))).toBe('2028-03-01')
  })
})

describe('endOfMonth — 이번 달 말일', () => {
  it('31일인 달', () => {
    expect(endOfMonth(new Date(2026, 9, 22))).toBe('2026-10-31')
  })

  it('30일인 달', () => {
    expect(endOfMonth(new Date(2026, 10, 5))).toBe('2026-11-30')
  })

  it('평년 2월', () => {
    expect(endOfMonth(new Date(2026, 1, 5))).toBe('2026-02-28')
  })

  it('윤년 2월', () => {
    expect(endOfMonth(new Date(2028, 1, 5))).toBe('2028-02-29')
  })

  it('말일에 불러도 그날이다', () => {
    expect(endOfMonth(new Date(2026, 9, 31))).toBe('2026-10-31')
  })
})
