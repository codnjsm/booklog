import { useEffect, type ReactNode } from 'react'

interface Props { onClose: () => void; children: ReactNode }

export default function Modal({ onClose, children }: Props) {
  useEffect(() => {
    // body { overflow: hidden } 만으로는 iOS 사파리에서 터치 스크롤이 안 막힌다.
    // body를 position: fixed로 아예 문서 흐름에서 빼서 스크롤 자체를 불가능하게 만든다.
    // html에도 overflow: hidden을 같이 걸어야 한다 — body만으로는 iOS에서 html이 스크롤 컨테이너로
    //남아있는 경우가 있다(모달 내용이 짧아 패널 자체에 스크롤할 게 없을 때 특히 드러남).
    const scrollY = window.scrollY
    const { body } = document
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <div
      // backdrop 자체는 touch-none으로 스크롤 제스처를 아예 무시한다.
      // 실제 스크롤 가능한 모달 패널 쪽에서 touch-auto로 다시 열어준다(각 모달의 MODAL_PANEL에 있음).
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[100] p-0 sm:p-5 backdrop-blur-sm touch-none"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}
