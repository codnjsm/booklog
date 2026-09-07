import { useEffect, useState, type ReactNode } from 'react'
import { useAppUI } from '../contexts/AppUIContext'
import { IconBooks, IconQuote, IconWord } from './layout/icons'

function FabAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 bg-transparent border-none cursor-pointer p-0">
      <span className="text-white text-sm font-medium whitespace-nowrap [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
        {label}
      </span>
      <span className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-card flex-shrink-0">
        {icon}
      </span>
    </button>
  )
}

export default function HomeFab() {
  const [open, setOpen] = useState(false)
  const { openAddBook, openAddQuote, openAddWord } = useAppUI()

  const close = () => setOpen(false)
  const run = (fn: () => void) => {
    close()
    fn()
  }

  useEffect(() => {
    if (!open) return
    // Modal.tsx와 동일하게 body를 position: fixed로 문서 흐름에서 빼서 iOS 사파리에서도 스크롤을 막는다.
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
  }, [open])

  return (
    <div className="sm:hidden">
      {open && <div onClick={close} className="fixed inset-0 bg-black/60 z-[90]" />}
      <div className="fixed z-[95] bottom-[calc(75px+env(safe-area-inset-bottom))] right-4 flex flex-col items-end gap-4">
        {open && (
          <>
            <FabAction icon={<IconBooks />} label="책 추가" onClick={() => run(openAddBook)} />
            <FabAction icon={<IconQuote />} label="문장 저장" onClick={() => run(() => openAddQuote())} />
            <FabAction icon={<IconWord />} label="단어 저장" onClick={() => run(openAddWord)} />
          </>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? '빠른 추가 닫기' : '빠른 추가'}
          className="w-14 h-14 rounded-full bg-accent text-white border-none cursor-pointer shadow-card flex items-center justify-center text-3xl font-light leading-none transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          +
        </button>
      </div>
    </div>
  )
}
