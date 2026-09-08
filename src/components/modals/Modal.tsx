import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  onClose: () => void
  children: ReactNode
  /** 이 모달의 제목 역할을 하는 요소의 id. 스크린리더가 모달을 무엇으로 부를지 정한다. */
  labelledBy?: string
}

export default function Modal({ onClose, children, labelledBy }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    // iOS 사파리는 키보드가 뜨면 레이아웃 뷰포트는 그대로 두고 '보이는 영역'만 줄인 뒤,
    // 사용자가 그 영역을 위아래로 밀 수 있게 한다. 이 밀기는 브라우저 자체 동작이라 CSS로 못 막는다.
    //
    // 그래서 역할을 둘로 나눈다:
    //   - 백드롭(바깥)은 항상 화면 전체를 덮는다. 크기를 건드리지 않으므로 안 덮인 틈이 생기지 않고,
    //     따라서 그 틈으로 뒷 화면이 보이거나 스크롤되는 일도 없다.
    //   - 배치 박스(안쪽)만 '보이는 영역'에 맞춰 옮긴다. 모달은 이 안에서 가운데 정렬되므로
    //     키보드가 올라오면 키보드 위 남은 공간의 중앙으로 따라 올라간다.
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const el = boxRef.current
      if (!el) return
      el.style.top = `${vv.offsetTop}px`
      el.style.height = `${vv.height}px`
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  const close = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    // 백드롭은 touch-none으로 스크롤 제스처를 아예 무시한다.
    // 실제 스크롤 가능한 모달 패널 쪽에서 touch-auto로 다시 열어준다(각 모달의 MODAL_PANEL에 있음).
    <div className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-sm touch-none" onClick={close}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="absolute inset-x-0 top-0 h-full flex items-center justify-center p-4 sm:p-5"
        onClick={close}
      >
        {children}
      </div>
    </div>
  )
}
