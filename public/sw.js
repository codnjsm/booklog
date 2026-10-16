// 푸시를 받을 그릇.
//
// 캐시를 두지 않고 fetch도 가로채지 않는다. 서비스워커가 위험한 건 화면 파일을 들고 있다가
// 배포를 해도 옛것을 내주기 때문인데, 둘 다 안 하면 화면 로딩에 아예 관여하지 않는다.
//
// skipWaiting + claim — 새 서비스워커가 기존 탭을 기다리지 않고 바로 교체된다.
// 홈 화면 앱은 잘 안 닫혀서 안 그러면 옛 서비스워커가 오래 남는다.
// 무엇보다 긴급 해제(docs/sw-kill.js)가 즉시 먹어야 한다.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
