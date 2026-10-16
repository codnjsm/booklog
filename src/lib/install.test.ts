import { describe, it, expect, afterEach, vi } from 'vitest'
import { shouldOfferInstall, installHow, isStandalone } from './install'

describe('shouldOfferInstall — 홈화면 안내를 띄울지', () => {
  const base = { signedIn: true, standalone: false, dismissed: false }

  it('로그인했고 아직 설치 안 했으면 권한다', () => {
    expect(shouldOfferInstall(base)).toBe(true)
  })

  it('비로그인에게는 권하지 않는다 — 설치하면 기록이 빈 것처럼 보인다', () => {
    expect(shouldOfferInstall({ ...base, signedIn: false })).toBe(false)
  })

  it('이미 홈화면 앱으로 보고 있으면 권하지 않는다', () => {
    expect(shouldOfferInstall({ ...base, standalone: true })).toBe(false)
  })

  it('닫은 적 있으면 다시 권하지 않는다', () => {
    expect(shouldOfferInstall({ ...base, dismissed: true })).toBe(false)
  })

  it('비로그인이면 다른 조건과 무관하게 권하지 않는다', () => {
    expect(shouldOfferInstall({ signedIn: false, standalone: false, dismissed: false })).toBe(false)
  })
})

describe('installHow — 기기별 안내 문구 고르기', () => {
  it('아이폰', () => {
    expect(installHow('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
  })

  it('아이패드', () => {
    expect(installHow('Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
  })

  it('안드로이드', () => {
    expect(installHow('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe('android')
  })

  it('그 외는 데스크톱으로 본다', () => {
    expect(installHow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')).toBe('desktop')
  })
})

describe('isStandalone — 지금 창이 홈화면 앱인지', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stub = (opts: { standalone?: boolean; navStandalone?: boolean; throws?: boolean }) => {
    vi.stubGlobal('window', {
      matchMedia: opts.throws
        ? () => {
            throw new Error('unsupported')
          }
        : (q: string) => ({ matches: !!opts.standalone && q.includes('standalone') }),
    })
    vi.stubGlobal('navigator', { standalone: opts.navStandalone, userAgent: '' })
  }

  it('display-mode가 standalone이면 참', () => {
    stub({ standalone: true })
    expect(isStandalone()).toBe(true)
  })

  it('브라우저 탭이면 거짓', () => {
    stub({ standalone: false })
    expect(isStandalone()).toBe(false)
  })

  it('iOS 옛 버전은 navigator.standalone으로 알아낸다', () => {
    stub({ standalone: false, navStandalone: true })
    expect(isStandalone()).toBe(true)
  })

  it('matchMedia를 못 쓰는 환경에서도 터지지 않는다', () => {
    stub({ throws: true })
    expect(isStandalone()).toBe(false)
  })
})
