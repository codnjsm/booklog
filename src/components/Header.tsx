import { useAppUI } from '../contexts/AppUIContext'

interface Props {
  onExport: () => void
}

const BTN = "bg-accent text-bg border-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] min-w-[50px] sm:min-w-0 cursor-pointer transition-all duration-150 font-sans hover:bg-accenthover disabled:opacity-50 disabled:cursor-not-allowed"
const BTN_SECONDARY = "bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] min-w-[50px] sm:min-w-0 cursor-pointer transition-all duration-150 font-sans hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"

export default function Header({ onExport }: Props) {
  const { changeTab, openAddBook } = useAppUI()
  return (
    <header className="flex justify-between items-center gap-2 sm:gap-4 flex-wrap sticky top-0 z-[80] bg-bg py-4 -mt-4 mb-4 sm:mb-6">
      <div className="flex flex-col gap-1 cursor-pointer" onClick={() => changeTab('books')}>
        <span className="inline-flex items-center rounded-[10px] text-[26px] sm:text-[28px] font-bold tracking-[-0.02em] font-mono text-[var(--logo)]">Booklog</span>
      </div>
      <div className="flex flex-col gap-1.5 items-stretch">
        <button className={BTN_SECONDARY} onClick={onExport}>기록 내보내기</button>
        <button className={BTN} onClick={openAddBook}>+ 책 추가</button>
      </div>
    </header>
  )
}
