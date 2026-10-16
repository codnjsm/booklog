/**
 * 서비스워커 탈출구.
 *
 * 서비스워커는 한 번 설치되면 사용자 브라우저에 남아서, 잘못 만들면 배포를 해도
 * 옛 화면을 계속 보여준다. 그 상태에서는 앱 안의 버튼으로 고칠 수도 없다 —
 * 버튼이 들어 있는 화면 자체가 옛것이기 때문이다.
 *
 * 그래서 주소만으로 되돌릴 수 있는 길을 만들어 둔다. 설치하기 **전에** 넣어야 의미가 있다.
 */

/** 이 값이 주소에 붙어 있으면 서비스워커를 걷어낸다. 예: https://…/?sw-off */
const KILL_PARAM = 'sw-off'

/** 주소에 탈출 신호가 들어 있는지. 값은 보지 않는다 — 붙어 있기만 하면 된다. */
export function wantsUnregister(search: string): boolean {
  return new URLSearchParams(search).has(KILL_PARAM)
}

/** 걷어낸 뒤 돌아갈 주소. 신호를 빼야 새로고침할 때마다 반복되지 않는다. */
export function urlWithoutKillParam(href: string): string {
  const url = new URL(href)
  url.searchParams.delete(KILL_PARAM)
  return url.toString()
}

/**
 * 등록된 서비스워커를 전부 해제하고 캐시도 비운다.
 * 지원하지 않는 브라우저나 실패한 경우에도 조용히 넘어간다 — 어차피 지울 게 없다는 뜻이다.
 */
export async function unregisterAll(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* 서비스워커를 못 쓰는 환경 */
  }
  try {
    const keys = (await caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* 캐시 저장소를 못 쓰는 환경 */
  }
}

/**
 * 앱이 뜨기 전에 한 번 확인한다. 신호가 있으면 걷어내고 신호를 뗀 주소로 새로고침한다.
 * 신호가 없으면 아무 일도 하지 않는다 — 평소 경로에 부담을 주지 않는다.
 *
 * @returns 새로고침을 예약했으면 true. 이때는 앱을 그리지 않는다.
 */
export async function handleKillSwitch(): Promise<boolean> {
  if (!wantsUnregister(window.location.search)) return false
  await unregisterAll()
  window.location.replace(urlWithoutKillParam(window.location.href))
  return true
}
