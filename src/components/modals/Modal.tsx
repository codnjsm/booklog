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
    const el = boxRef.current
    if (!el) return

    // iOS 사파리가 키보드 위에 붙이는 입력창 이동 바(위/아래 화살표 + 완료)는 visualViewport
    // 계산에 안 잡힌다. 그만큼 안 빼주면 모달 패널 아래쪽이 그 바 뒤로 살짝 걸쳐 흰 모서리가
    // 바 틈새로 비친다. 텍스트 입력 중(=키보드가 떠 있을 때)에만 그 높이만큼 더 줄인다.
    const INPUT_TOOLBAR_HEIGHT = 50
    const sync = () => {
      if (!vv) return
      const active = document.activeElement
      const isTyping =
        active instanceof HTMLElement &&
        el.contains(active) &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
      const keyboardOpen = vv.height < window.innerHeight
      const buffer = isTyping && keyboardOpen ? INPUT_TOOLBAR_HEIGHT : 0
      el.style.top = `${vv.offsetTop}px`
      el.style.height = `${vv.height - buffer}px`
    }

    // 포커스된 입력창이 키보드에 가려지면, 키보드가 올라오는 애니메이션이 끝나길 기다렸다가
    // (박스 크기부터 다시 맞춘 뒤) 그 입력창이 보이는 영역 안으로 들어오게 스크롤한다.
    // 브라우저는 포커스만 옮길 뿐 이 스크롤을 대신 해주지 않는다.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target
      if (!(target instanceof HTMLElement)) return
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return
      setTimeout(() => {
        sync()
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 300)
    }
    // 필드 사이를 옮겨 다닐 때(키보드 크기는 그대로라 resize가 안 뜸)도 입력창 이동 바
    // 여백을 뗐다 붙였다 해야 하므로, 포커스가 빠질 때도 다시 맞춘다.
    const onFocusOut = () => sync()

    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    el.addEventListener('focusin', onFocusIn)
    el.addEventListener('focusout', onFocusOut)
    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      el.removeEventListener('focusin', onFocusIn)
      el.removeEventListener('focusout', onFocusOut)
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
