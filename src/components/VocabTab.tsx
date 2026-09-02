import type { Word } from '../types'

interface Props {
  words: Word[]
  onDeleteWord: (id: string) => void
}

export default function VocabTab({ words, onDeleteWord }: Props) {
  const sorted = [...words].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return (
    <div>
      {sorted.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <div className="text-[40px] mb-3 opacity-60">📖</div>
          <h3 className="font-sans text-ink mb-1.5 text-[15px]">아직 저장한 단어가 없어요</h3>
          <p className="text-sm">사전 탭에서 단어를 검색하고 저장해보세요</p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          {sorted.map((w) => (
            <div key={w.id} className="bg-surface border border-border rounded-[10px] px-4 py-3.5 sm:px-[22px] sm:py-5 transition-all duration-150 shadow-[inset_3px_0_0_var(--accent)]">
              <div className="font-serif text-base leading-[1.7] mb-3 text-ink">{w.term}</div>
              <div className="text-xs sm:text-[13px] text-dim mb-2.5">{w.meaning}</div>
              <div className="flex gap-1.5 justify-end">
                <button className="bg-transparent text-danger border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10" onClick={() => onDeleteWord(w.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
