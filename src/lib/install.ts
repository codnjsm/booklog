/**
 * 홈화면 설치 안내를 보여줄지 판단한다.
 *
 * 브라우저는 "이 사람이 홈화면에 추가해뒀는지"를 알려주지 않는다. 알려주는 건
 * **지금 열린 창이 홈화면 앱인지**뿐이다. 그래서 설치해두고 사파리로 들어오면 또 권하게 되는데,
 * 그건 「이미 추가했어요」로 닫아 기억시키는 수밖에 없다.
 */

/** 안내를 닫은 기록. 읽음 시각과 같은 이유로 이 브라우저에만 남긴다. */
const DISMISSED_KEY = 'reading-notes-install-dismissed-v1'

/** 홈화면 앱으로 열렸는지. iOS 옛 버전은 navigator.standalone으로만 알 수 있다. */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export function readInstallDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function markInstallDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    /* 저장에 실패해도 이번 화면에서는 닫힌 채로 둔다 */
  }
}

/**
 * 안내를 보여줄지.
 *
 * 비로그인 사용자에게는 권하지 않는다 — iOS에서 홈화면 앱은 사파리와 저장소가 분리돼서,
 * 게스트가 설치하면 **기록이 빈 화면으로 보인다.** 로그인이 먼저다.
 */
export function shouldOfferInstall(args: { signedIn: boolean; standalone: boolean; dismissed: boolean }): boolean {
  if (!args.signedIn) return false
  if (args.standalone) return false
  return !args.dismissed
}

/** 기기별 안내 문구. iOS는 설치 버튼을 띄울 수 없어 직접 경로를 알려줘야 한다. */
export type InstallHow = 'ios' | 'android' | 'desktop'

export function installHow(ua: string = navigator.userAgent): InstallHow {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}
