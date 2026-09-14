import { useEffect, useState } from 'react'
import { useAppUI } from '../contexts/AppUIContext'

// 상태별 테두리·아이콘. info는 기존 스타일 그대로(테두리만 중립으로) 아이콘 없이 둔다.
const ICON_WRAP = 'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0'

export default function Toast() {
  const { toast } = useAppUI()
  const msg = toast?.msg ?? ''
  const type = toast?.type ?? 'info'
  const toastKey = toast?.key
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!toastKey) return
    setMounted(true)
    // 숨은 상태가 한 번 그려진 다음에 보이게 해야 '등장' 전환이 실제로 재생된다.
    // 같은 렌더에서 바로 visible=true로 두면 전환할 이전 상태가 없어 툭 튀어나온다.
    let enterFrame = 0
    const paintFrame = requestAnimationFrame(() => {
      enterFrame = requestAnimationFrame(() => setVisible(true))
    })
    const hideTimer = setTimeout(() => setVisible(false), 2200)
    const unmountTimer = setTimeout(() => setMounted(false), 2600) // after 0.3s fade-out finishes
    return () => {
      cancelAnimationFrame(paintFrame)
      cancelAnimationFrame(enterFrame)
      clearTimeout(hideTimer)
      clearTimeout(unmountTimer)
    }
  }, [toastKey])

  if (!mounted) return null
  return (
    <div
      // 모바일은 하단 탭바 위 하단 중앙, PC(sm 이상)는 상단 중앙 — 등장 방향도 그에 맞춰
      // 모바일은 아래에서, PC는 위에서 슬라이드해 들어온다.
      // 화면 밖까지 밀어내는 대신 살짝 밀면서 같이 사라진다 — 토스트가 화면 가장자리에서
      // 떨어져 있어 슬라이드만으로는 밖으로 빠져나가지 못하고 중간에 툭 끊겨 보인다.
      className={`fixed bottom-[calc(78px+env(safe-area-inset-bottom))] sm:bottom-auto sm:top-6 left-1/2 -translate-x-1/2 bg-surface text-ink pl-4 pr-5 py-3 border rounded-lg text-xs sm:text-[13px] z-[200] shadow-card flex items-center gap-2.5 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${type === 'error' ? 'border-danger' : 'border-border'} ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 sm:-translate-y-2'}`}
    >
      {type === 'success' && (
        <span className={`${ICON_WRAP} bg-ok`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {type === 'error' && (
        <span className={`${ICON_WRAP} bg-danger`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </span>
      )}
      {msg}
    </div>
  )
}
