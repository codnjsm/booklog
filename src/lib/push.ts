/**
 * 웹 푸시 설정.
 *
 * 푸시를 받으려면 세 가지가 모두 맞아야 한다 — 브라우저가 지원하고, 사용자가 허용했고,
 * 보낼 주소(토큰)를 서버가 알고 있어야 한다. 하나라도 빠지면 앱 내 알림함만 쓴다.
 */

/**
 * 웹 푸시 인증서의 공개 키 (Firebase Console > 클라우드 메시징 > 웹 푸시 인증서).
 *
 * 공개 키라 클라이언트에 노출돼도 된다 — reCAPTCHA 사이트 키와 같은 성격이다.
 * 비어 있으면 푸시 기능 전체가 꺼진 것으로 본다. 앱은 그대로 동작한다.
 */
export const VAPID_PUBLIC_KEY =
  'BDBGo4oQHD7tXqjVWw7ujN-Jgs0iFYPGF_BOPDVSJxtpXJjksscdHjHSEzUDncYc6PUfSHsImypTnLwr0eOmu1U'

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0
}

/**
 * 토큰을 담을 문서 id.
 *
 * 토큰을 그대로 쓰면 안 된다 — Firestore 문서 id는 '/'를 담을 수 없다.
 * 같은 기기가 다시 켜도 같은 id가 나와야 중복이 안 쌓이므로 무작위 id도 쓸 수 없다.
 * 치환으로 서로 다른 토큰이 같은 id가 될 가능성은 남지만, 그래도 **같은 사용자의 기기끼리**라
 * 영향 범위가 본인 기기 하나다. 원본 토큰은 문서 안에 따로 담아 둔다.
 */
export function tokenDocId(token: string): string {
  return token.replace(/\//g, '_')
}

/** 알림 권한의 현재 상태. 브라우저가 Notification을 모르면 '못 씀'으로 본다. */
export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export function permissionState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported'
  const p = Notification.permission
  return p === 'granted' || p === 'denied' ? p : 'default'
}

/**
 * 권한을 물어볼 만한 상태인지.
 *
 * 브라우저는 **한 번 거절당하면 다시 묻지 못한다** — 설정에 들어가 직접 켜야 하는데 아무도 안 한다.
 * 그래서 이미 허용했거나 거절한 사람에게는 묻지 않는다.
 */
export function canAskPermission(state: PermissionState): boolean {
  return state === 'default'
}

/**
 * 이 브라우저가 마지막으로 받은 토큰.
 *
 * 끌 때 다시 발급받아 지우면 **지우려는 순간에 새 토큰을 만드는** 꼴이라, 켤 때 받아둔 걸 기억한다.
 * 로그아웃할 때도 이 값으로 그 기기 것만 지운다.
 */
const TOKEN_KEY = 'reading-notes-fcm-token-v1'

export function readSavedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeSavedToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* 저장을 못 해도 이번 방문에서는 동작한다 */
  }
}

/**
 * 더보기의 알림 줄이 어떤 모습이어야 하는지.
 *
 * 다섯 갈래로 갈린다. 토글만 두면 "왜 안 켜지지"를 설명할 길이 없어서, 못 켜는 이유도 상태로 둔다.
 */
export type PushUiState =
  /** 켜짐 — 이 기기로 알림이 온다 */
  | 'on'
  /** 꺼짐 — 누르면 권한을 묻는다 */
  | 'off'
  /** 브라우저가 막아둠 — 앱에서는 못 푼다. 설정으로 보내야 한다 */
  | 'denied'
  /** iOS는 홈 화면에 추가해야 알림을 받는다 */
  | 'needsInstall'
  /** 이 브라우저는 웹 푸시를 못 쓴다 */
  | 'unsupported'

export function pushUiState(args: {
  configured: boolean
  supported: boolean
  /** iOS인데 아직 홈 화면 앱이 아닌 상태 */
  iosNeedsInstall: boolean
  permission: PermissionState
  hasToken: boolean
}): PushUiState {
  if (!args.configured) return 'unsupported'
  // 지원 여부보다 먼저 본다 — iOS 사파리는 홈 화면에 추가하기 전까지 아예 Notification이 없어서,
  // 그냥 '못 씀'으로 보이면 추가하면 된다는 걸 알 길이 없다.
  if (args.iosNeedsInstall) return 'needsInstall'
  if (!args.supported) return 'unsupported'
  if (args.permission === 'denied') return 'denied'
  if (args.permission === 'granted' && args.hasToken) return 'on'
  return 'off'
}
