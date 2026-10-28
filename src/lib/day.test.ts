import { describe, it, expect } from 'vitest'
import { toDayString, isoToDay, today, dayAfter, endOfMonth, toggleDay, daysUntil } from './day'

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

describe('toggleDay — 읽은 날 켜고 끄기', () => {
  it('없으면 넣는다', () => {
    expect(toggleDay(['2026-10-26'], '2026-10-28')).toEqual(['2026-10-26', '2026-10-28'])
  })

  it('있으면 뺀다', () => {
    expect(toggleDay(['2026-10-26', '2026-10-28'], '2026-10-26')).toEqual(['2026-10-28'])
  })

  it('목록이 아직 없으면 그 하루만 담는다', () => {
    expect(toggleDay(undefined, '2026-10-28')).toEqual(['2026-10-28'])
  })

  it('하나뿐인 날을 빼면 빈 목록', () => {
    expect(toggleDay(['2026-10-28'], '2026-10-28')).toEqual([])
  })

  it('항상 오름차순 — 시작일·완독일이 이 순서에서 파생된다', () => {
    expect(toggleDay(['2026-10-28', '2026-10-26'], '2026-10-27')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
  })

  it('원본을 바꾸지 않는다', () => {
    const before = ['2026-10-26']
    toggleDay(before, '2026-10-28')
    expect(before).toEqual(['2026-10-26'])
  })
})

describe('daysUntil — 남은 날 수', () => {
  const now = new Date(2026, 9, 28)

  it('오늘이 마지막 날이면 1 — 오늘도 기록할 수 있다', () => {
    expect(daysUntil('2026-10-28', now)).toBe(1)
  })

  it('내일이 마지막이면 2', () => {
    expect(daysUntil('2026-10-29', now)).toBe(2)
  })

  it('이미 지났으면 0', () => {
    expect(daysUntil('2026-10-27', now)).toBe(0)
  })

  it('달을 넘겨도 센다', () => {
    expect(daysUntil('2026-11-02', now)).toBe(6)
  })

  it('깨진 값이면 0 — 화면이 NaN을 그리지 않게', () => {
    expect(daysUntil('', now)).toBe(0)
    expect(daysUntil('어제', now)).toBe(0)
  })
})
