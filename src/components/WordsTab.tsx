import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Word } from '../types'
import { isThisWeek, relativeDay } from '../lib/insights'
import { IconSearch } from './layout/icons'

interface DictSense { definition: string; pos?: string }
interface DictItem { word: string; sense?: DictSense[] }
interface DictResponse { channel?: { item?: DictItem[] } }

interface Props {
  words: Word[]
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
  onDeleteWord: (id: string) => void
}

async function searchDict(q: string): Promise<DictItem[]> {
  const res = await fetch(`/api/koreanDictSearch?query=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('search failed')
  const data = await res.json() as DictResponse
  return data.channel?.item || []
}

export default function WordsTab({ words, onAddWord, onDeleteWord }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInput = (v: string) => {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(v), 400)
  }

  const { data: results = [], isFetching: loading, isError: error, isSuccess } = useQuery({
    queryKey: ['koreanDict', debouncedQuery],
    queryFn: () => searchDict(debouncedQuery),
    enabled: debouncedQuery.length >= 1,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const saved = new Set(words.map((w) => `${w.term}|${w.meaning}`))
  const sorted = [...words].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return (
    <div className="flex flex-col gap-4">

      <div className={`bg-surface border rounded-xl overflow-hidden ${debouncedQuery ? 'border-accent' : 'border-border'}`}>
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className={debouncedQuery ? 'text-accent' : 'text-dim'}><IconSearch size={17} /></span>
          <input
            type="text"
            placeholder="뜻을 찾을 단어 입력"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent border-none text-ink text-[15px] font-sans outline-none placeholder:text-dim placeholder:opacity-60"
          />
          {loading && <span className="font-mono text-[11px] text-dim">검색중…</span>}
          {!loading && isSuccess && <span className="font-mono text-[11px] text-dim">우리말샘 · {results.length}건</span>}
        </div>

        {error && (
          <div className="border-t border-border bg-bg px-4 py-4 text-[13px] text-dim">검색 중 오류가 발생했어요</div>
        )}
        {!loading && !error && isSuccess && results.length === 0 && (
          <div className="border-t border-border bg-bg px-4 py-4 text-[13px] text-dim">검색 결과가 없어요</div>
        )}
        {!loading && results.length > 0 && (
          <div className="border-t border-border bg-bg max-h-[320px] overflow-y-auto">
            {results.map((item, i) => (
              <div key={i}>
                {(item.sense || []).map((s, j) => {
                  const isSaved = saved.has(`${item.word}|${s.definition}`)
                  return (
                    <div key={j} className="flex items-start gap-3.5 px-4 py-3 border-b border-surface2 last:border-b-0">
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="text-[13px] font-semibold">
                          {item.word}
                          {s.pos && <span className="font-mono text-[10px] font-normal text-dim ml-1.5">{s.pos}</span>}
                        </div>
                        <div className="text-xs leading-relaxed text-dim">{s.definition}</div>
                      </div>
                      {isSaved ? (
                        <span className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-surface2 text-dim">저장됨</span>
                      ) : (
                        <button
                          onClick={() => onAddWord({ term: item.word, meaning: s.definition })}
                          className="flex-shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accenthover"
                        >저장</button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] tracking-[0.09em] text-dim">SAVED WORDS {words.length}</span>
        {words.some((w) => isThisWeek(w.createdAt)) && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-dim">
            <span className="w-4 h-2 rounded-sm bg-highlight" />이번 주에 담은 단어
          </span>
        )}
        <span className="flex-1 h-px bg-border" />
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-[52px] px-5 text-dim bg-surface border border-dashed border-border rounded-xl">
          <p className="text-sm">위에서 단어를 검색하고 저장해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sorted.map((w) => {
            const fresh = isThisWeek(w.createdAt)
            return (
              <div key={w.id} className={`group bg-surface border rounded-[10px] px-4 py-3.5 flex flex-col gap-1.5 ${fresh ? 'border-highlight' : 'border-border'}`}>
                <div className="flex items-start gap-2">
                  <div className="font-serif text-base font-semibold leading-snug flex-1">
                    {fresh ? <span className="bg-[linear-gradient(transparent_56%,var(--highlight)_56%)]">{w.term}</span> : w.term}
                  </div>
                  <button
                    onClick={() => onDeleteWord(w.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-dim hover:text-danger bg-transparent border-none cursor-pointer text-sm leading-none p-0.5"
                    aria-label="단어 삭제"
                  >×</button>
                </div>
                <div className="text-xs leading-relaxed text-dim">{w.meaning}</div>
                <div className="font-mono text-[10px] text-dim opacity-70">{relativeDay(w.createdAt)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
