import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Word } from '../types'
import { IconSearch } from './layout/icons'
import { fetchWithAppCheck } from '../firebase'

interface DictSense { definition: string; pos?: string }
interface DictItem { word: string; sense?: DictSense[] }
interface DictResponse { channel?: { item?: DictItem[] } }

interface Props {
  words: Word[]
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
}

async function searchDict(q: string): Promise<DictItem[]> {
  const res = await fetchWithAppCheck(`/api/koreanDictSearch?query=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('search failed')
  const data = await res.json() as DictResponse
  return data.channel?.item || []
}

export default function WordSearchPanel({ words, onAddWord }: Props) {
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

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden focus-within:border-accent">
      <div className="flex items-center gap-2 px-3">
        <span className="text-dim flex-shrink-0"><IconSearch /></span>
        <input
          type="text"
          placeholder="뜻을 찾을 단어 입력"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          autoComplete="off"
          className="flex-1 min-w-0 bg-transparent border-none text-ink py-[9px] text-base font-sans placeholder:text-dim focus:outline-none"
        />
        {loading && <span className="font-mono text-[11px] text-dim flex-shrink-0">검색중…</span>}
        {!loading && isSuccess && <span className="font-mono text-[11px] text-dim flex-shrink-0">우리말샘 · {results.length}건</span>}
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
  )
}
