import { describe, it, expect } from 'vitest'
import {
  tokenDocId,
  canAskPermission,
  isPushConfigured,
  VAPID_PUBLIC_KEY,
  pushUiState,
  shouldOfferPush,
  shouldAskAfterAccept,
} from './push'

describe('tokenDocId — 토큰을 문서 id로', () => {
  it('같은 토큰이면 항상 같은 id — 기기를 다시 켜도 중복이 안 쌓인다', () => {
    const t = 'abc:APA91bExample_token-value'
    expect(tokenDocId(t)).toBe(tokenDocId(t))
  })

  it("Firestore 문서 id에 못 쓰는 '/'를 치환한다", () => {
    expect(tokenDocId('aa/bb/cc')).toBe('aa_bb_cc')
    expect(tokenDocId('aa/bb/cc')).not.toContain('/')
  })

  it('콜론·하이픈·밑줄은 그대로 둔다 — 문서 id에 쓸 수 있다', () => {
    expect(tokenDocId('a:b-c_d')).toBe('a:b-c_d')
  })

  it('다른 토큰은 다른 id가 된다', () => {
    expect(tokenDocId('token-one')).not.toBe(tokenDocId('token-two'))
  })
})

describe('canAskPermission — 권한을 물어볼지', () => {
  it('아직 안 물어봤으면 묻는다', () => {
    expect(canAskPermission('default')).toBe(true)
  })

  it('이미 허용했으면 또 묻지 않는다', () => {
    expect(canAskPermission('granted')).toBe(false)
  })

  it('거절당했으면 묻지 않는다 — 브라우저가 다시 묻는 걸 막는다', () => {
    expect(canAskPermission('denied')).toBe(false)
  })

  it('지원하지 않는 브라우저에서도 묻지 않는다', () => {
    expect(canAskPermission('unsupported')).toBe(false)
  })
})

describe('isPushConfigured — 인증서 키가 있는지', () => {
  it('키가 비어 있으면 푸시 기능이 꺼진 것으로 본다', () => {
    expect(isPushConfigured()).toBe(VAPID_PUBLIC_KEY.length > 0)
  })
})

describe('pushUiState — 알림 줄이 어떤 모습일지', () => {
  const base = {
    configured: true,
    supported: true,
    iosNeedsInstall: false,
    permission: 'granted' as const,
    hasToken: true,
  }

  it('허용했고 토큰이 있으면 켜짐', () => {
    expect(pushUiState(base)).toBe('on')
  })

  it('아직 안 물어봤으면 꺼짐', () => {
    expect(pushUiState({ ...base, permission: 'default', hasToken: false })).toBe('off')
  })

  it('허용은 했는데 토큰이 없으면 꺼짐 — 다른 기기에서 켠 경우다', () => {
    expect(pushUiState({ ...base, hasToken: false })).toBe('off')
  })

  it('브라우저가 막아뒀으면 그 사실을 알린다 — 앱에서는 못 푼다', () => {
    expect(pushUiState({ ...base, permission: 'denied' })).toBe('denied')
  })

  it('iOS인데 홈 화면 앱이 아니면 추가부터 안내한다', () => {
    expect(pushUiState({ ...base, iosNeedsInstall: true })).toBe('needsInstall')
  })

  it('iOS 안내가 지원 여부보다 먼저다 — 사파리는 추가 전까지 Notification이 없다', () => {
    expect(pushUiState({ ...base, iosNeedsInstall: true, supported: false, permission: 'unsupported' })).toBe(
      'needsInstall',
    )
  })

  it('웹 푸시를 못 쓰는 브라우저면 못 씀', () => {
    expect(pushUiState({ ...base, supported: false })).toBe('unsupported')
  })

  it('인증서 키가 없으면 기능 자체가 꺼진 것으로 본다', () => {
    expect(pushUiState({ ...base, configured: false })).toBe('unsupported')
  })
})

describe('shouldOfferPush — 알림함에 「폰으로도 받기」를 띄울지', () => {
  it('켤 수 있는 상태면 띄운다', () => {
    expect(shouldOfferPush('off', false)).toBe(true)
  })

  it('이미 켰으면 안 띄운다', () => {
    expect(shouldOfferPush('on', false)).toBe(false)
  })

  it('브라우저가 막아뒀으면 안 띄운다 — 눌러도 안 되는 안내는 거짓말이다', () => {
    expect(shouldOfferPush('denied', false)).toBe(false)
  })

  it('iOS인데 홈 화면에 없어도 띄운다 — 켜지는 못해도 켤 길은 알려준다', () => {
    expect(shouldOfferPush('needsInstall', false)).toBe(true)
  })

  it('못 쓰는 브라우저면 안 띄운다', () => {
    expect(shouldOfferPush('unsupported', false)).toBe(false)
  })

  it('아직 상태를 모르면 안 띄운다 — 깜빡이면 안 된다', () => {
    expect(shouldOfferPush(null, false)).toBe(false)
  })

  it('한 번 닫았으면 다시 안 띄운다', () => {
    expect(shouldOfferPush('off', true)).toBe(false)
  })
})

describe('shouldAskAfterAccept — 친구 요청 수락 직후에 물을지', () => {
  it('켤 수 있고 아직 안 물었으면 묻는다', () => {
    expect(shouldAskAfterAccept('off', false)).toBe(true)
  })

  it('한 번 물었으면 다시 묻지 않는다 — 거절당하면 영영 못 묻는다', () => {
    expect(shouldAskAfterAccept('off', true)).toBe(false)
  })

  it('이미 켰으면 묻지 않는다', () => {
    expect(shouldAskAfterAccept('on', false)).toBe(false)
  })

  it('브라우저가 막아뒀으면 묻지 않는다', () => {
    expect(shouldAskAfterAccept('denied', false)).toBe(false)
  })

  it('상태를 모르면 묻지 않는다', () => {
    expect(shouldAskAfterAccept(null, false)).toBe(false)
  })
})
