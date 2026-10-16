import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { handleKillSwitch, registerServiceWorker } from './lib/serviceWorker'

// 주소에 ?sw-off가 붙어 있으면 서비스워커를 걷어내고 다시 연다.
// 앱을 그리기 전에 처리해야 한다 — 옛 화면이 떠서 손쓸 수 없게 되는 걸 막는 길이다.
handleKillSwitch().then((reloading) => {
  if (reloading) return
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // 탈출 처리가 끝난 뒤에 붙인다. 걷어내러 들어온 사람에게 다시 깔면 안 된다.
  registerServiceWorker()
})
