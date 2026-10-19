// 푸시를 받는 서비스워커.
//
// 캐시를 두지 않고 fetch도 가로채지 않는다. 서비스워커가 위험한 건 화면 파일을 들고 있다가
// 배포를 해도 옛것을 내주기 때문인데, 둘 다 안 하면 화면 로딩에 아예 관여하지 않는다.
//
// skipWaiting + claim — 새 서비스워커가 기존 탭을 기다리지 않고 바로 교체된다.
// 홈 화면 앱은 잘 안 닫혀서 안 그러면 옛 서비스워커가 오래 남는다.
// 무엇보다 긴급 해제(docs/sw-kill.js)가 즉시 먹어야 한다.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/**
 * 푸시가 오면 알림을 띄운다.
 *
 * 서버는 data로만 보낸다. notification으로 보내면 브라우저가 알아서 그리는데,
 * 기기마다 모양이 다르고 두 번 뜨는 경우도 있어서 여기서 직접 그린다.
 *
 * 내용이 깨져 있어도 **반드시 뭔가는 띄워야 한다** — 푸시를 받고 아무것도 안 띄우면
 * 브라우저가 "조용한 푸시"로 보고 권한을 거둬간다.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json()?.data ?? {}
  } catch {
    /* 형식이 달라도 아래에서 기본값으로 띄운다 */
  }
  const title = data.title || 'Booklog'
  const body = data.body || '새로운 소식이 있어요'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: data.url || '/' },
      // 같은 종류가 연달아 오면 쌓지 않고 최신 것만 남긴다.
      tag: data.url || 'booklog',
      renotify: true,
    }),
  )
})

/**
 * 알림을 누르면 그 화면으로 간다.
 * 이미 열려 있는 창이 있으면 새로 열지 않고 그 창을 쓴다 — 창이 여러 개 쌓이면 성가시다.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const target = new URL(url, self.location.origin)
      const open = clients.find((c) => new URL(c.url).origin === target.origin)
      if (open) {
        await open.focus()
        if ('navigate' in open) await open.navigate(target.href).catch(() => {})
        return
      }
      await self.clients.openWindow(target.href)
    })(),
  )
})
