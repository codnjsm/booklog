import Modal from './Modal'
import type { Word } from '../../types'
import WordSearchPanel from '../WordSearchPanel'

interface Props { words: Word[]; onClose: () => void; onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void }

// 검색 전에는 내용이 짧아 바텀시트가 화면 아래에 얇게 붙어 보인다.
// 모바일에서만 화면 절반을 최소 높이로 잡아준다 (데스크탑은 가운데 정렬이라 불필요).
const MODAL_PANEL = "bg-surface border border-border rounded-t-2xl sm:rounded-xl w-full max-w-full sm:max-w-[560px] min-h-[50%] sm:min-h-0 max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card"
const MODAL_HEADER = "sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center"
const MODAL_CLOSE = "bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink"
const MODAL_BODY = "px-[18px] py-3.5 sm:px-6 sm:py-[22px]"

export default function AddWordModal({ words, onClose, onAddWord }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}><h3 className="font-sans text-base font-semibold">단어 저장</h3><button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">×</button></div>
        <div className={MODAL_BODY}>
          <WordSearchPanel words={words} onAddWord={onAddWord} />
        </div>
      </div>
    </Modal>
  )
}
