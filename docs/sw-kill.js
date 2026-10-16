// 서비스워커 긴급 해제용 파일. 평소에는 배포하지 않는다.
//
// 쓰는 때 — 서비스워커가 옛 화면을 붙들고 있어 배포해도 반영되지 않을 때.
// 쓰는 법 — 이 파일의 내용을 서비스워커 자리(public/sw.js)에 덮어쓰고 호스팅을 배포한다.
//
// 브라우저는 페이지를 열 때 서비스워커 파일이 바뀌었는지 확인한다. 그래서 이걸 올리면
// 망가진 서비스워커가 이것으로 교체되고, 이것은 설치되자마자 스스로를 지운다.
// 사용자가 아무것도 안 해도 다음 방문에 정상으로 돌아온다.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    })(),
  )
})
