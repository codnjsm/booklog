import { describe, it, expect } from 'vitest'
import { wantsUnregister, urlWithoutKillParam } from './serviceWorker'

describe('wantsUnregister — 주소에 붙은 탈출 신호', () => {
  it('?sw-off가 있으면 걷어낸다', () => {
    expect(wantsUnregister('?sw-off')).toBe(true)
  })

  it('값이 붙어 있어도 걷어낸다 — 붙어 있기만 하면 된다', () => {
    expect(wantsUnregister('?sw-off=1')).toBe(true)
  })

  it('다른 파라미터와 섞여 있어도 찾는다', () => {
    expect(wantsUnregister('?view=feed&sw-off')).toBe(true)
  })

  it('없으면 아무 일도 하지 않는다', () => {
    expect(wantsUnregister('')).toBe(false)
    expect(wantsUnregister('?view=feed')).toBe(false)
  })

  it('비슷한 이름에 걸리지 않는다', () => {
    expect(wantsUnregister('?sw-office=1')).toBe(false)
    expect(wantsUnregister('?sw=off')).toBe(false)
  })
})

describe('urlWithoutKillParam — 신호를 뗀 주소', () => {
  it('신호만 빠진다', () => {
    expect(urlWithoutKillParam('https://x.app/books?sw-off')).toBe('https://x.app/books')
  })

  it('다른 파라미터는 남는다', () => {
    expect(urlWithoutKillParam('https://x.app/friends?view=feed&sw-off')).toBe('https://x.app/friends?view=feed')
  })

  it('경로와 해시를 지킨다', () => {
    expect(urlWithoutKillParam('https://x.app/records?sw-off#top')).toBe('https://x.app/records#top')
  })

  it('신호가 없으면 그대로 둔다', () => {
    expect(urlWithoutKillParam('https://x.app/books?view=feed')).toBe('https://x.app/books?view=feed')
  })
})
