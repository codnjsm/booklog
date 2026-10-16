import { describe, it, expect } from 'vitest'
import { wantsUnregister, urlWithoutKillParam, shouldRegister, wantsRegister } from './serviceWorker'

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

describe('shouldRegister — 서비스워커를 깔지', () => {
  it('평소에는 깐다', () => {
    expect(shouldRegister('', false)).toBe(true)
    expect(shouldRegister('?view=feed', false)).toBe(true)
  })

  it('걷어내러 들어온 사람에게는 다시 깔지 않는다', () => {
    expect(shouldRegister('?sw-off', false)).toBe(false)
  })

  it('한 번 꺼두면 신호가 없어도 계속 안 깐다 — 걷어낸 직후 새로고침에서 되살아나면 안 된다', () => {
    expect(shouldRegister('', true)).toBe(false)
    expect(shouldRegister('?view=feed', true)).toBe(false)
  })
})

describe('wantsRegister — 다시 켜는 신호', () => {
  it('?sw-on이 있으면 참', () => {
    expect(wantsRegister('?sw-on')).toBe(true)
  })

  it('없으면 거짓이고, 끄는 신호와 헷갈리지 않는다', () => {
    expect(wantsRegister('')).toBe(false)
    expect(wantsRegister('?sw-off')).toBe(false)
  })
})
