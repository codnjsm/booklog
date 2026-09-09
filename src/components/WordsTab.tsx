import type { Word } from '../types'
import { isThisWeek, relativeDay } from '../lib/insights'
import { IconWord } from './layout/icons'
import WordSearchPanel from './WordSearchPanel'

interface Props {
  words: Word[]
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
  onDeleteWord: (id: string) => void
}

export default function WordsTab({ words, onAddWord, onDeleteWord }: Props) {
  const sorted = [...words].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return (
    <div className="flex flex-col gap-4">
      <WordSearchPanel words={words} onAddWord={onAddWord} />

      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] sm:text-[12px] tracking-[0.09em] text-dim">
          SAVED WORDS {words.length}
        </span>
        {words.some((w) => isThisWeek(w.createdAt)) && (
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-dim">
            <span className="w-4 h-2 rounded-sm bg-highlight" />
            이번 주에 담은 단어
          </span>
        )}
        <span className="flex-1 h-px bg-border" />
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
          <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
            <IconWord size={22} />
          </div>
          <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">아직 저장한 단어가 없어요</h3>
          <p className="text-xs sm:text-[13px]">위에서 단어를 검색하고 저장해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sorted.map((w) => {
            const fresh = isThisWeek(w.createdAt)
            return (
              <div
                key={w.id}
                className={`group bg-surface border rounded-[10px] px-4 py-3.5 flex flex-col gap-1.5 ${fresh ? 'border-highlight' : 'border-border'}`}
              >
                <div className="flex items-start gap-2">
                  <div className="font-serif text-sm sm:text-[15px] font-semibold leading-snug flex-1">
                    {fresh ? (
                      <span className="bg-[linear-gradient(transparent_56%,var(--highlight)_56%)]">{w.term}</span>
                    ) : (
                      w.term
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteWord(w.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-dim hover:text-danger bg-transparent border-none cursor-pointer text-sm leading-none p-0.5"
                    aria-label="단어 삭제"
                  >
                    ×
                  </button>
                </div>
                <div className="text-xs sm:text-[13px] leading-relaxed text-dim">{w.meaning}</div>
                <div className="font-mono text-[10px] text-dim opacity-70">{relativeDay(w.createdAt)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
