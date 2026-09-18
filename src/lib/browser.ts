/**
 * Safari(데스크톱)와 아이폰의 모든 브라우저(iOS는 엔진이 전부 WebKit)는 ITP 정책으로,
 * 7일간 접속하지 않으면 localStorage를 브라우저가 알아서 지울 수 있다. 크롬·안드로이드는 해당 없음.
 * 이 브라우저에서만 게스트 데이터 유실 위험을 구체적으로 경고할 때 쓴다.
 */
export function isStorageAtRiskBrowser(): boolean {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua)
  return isIOS || isSafari
}
