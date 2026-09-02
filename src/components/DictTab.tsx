import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Word } from '../types'

interface DictSense { definition: string; pos?: string }
interface DictItem { word: string; sense?: DictSense[] }
interface DictResponse { channel?: { item?: DictItem[] } }

interface Props {
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
}

const BTN_SMALL_SECONDARY = "bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"

async function searchDict(q: string): Promise<DictItem[]> {
  const res = await fetch(`/api/koreanDictSearch?query=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('search failed')
  const data = await res.json() as DictResponse
  return data.channel?.item || []
}

export default function DictTab({ onAddWord }: Props) {
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

  return (
    <div>
      <div className="mb-5 w-full">
        <input type="text" placeholder="뜻을 찾을 단어 입력" value={query} onChange={(e) => handleInput(e.target.value)} autoComplete="off" autoFocus
          className="w-full bg-surface border border-border text-ink px-3.5 py-[9px] rounded-lg text-base font-sans focus:outline-none focus:border-accent" />
      </div>
      {loading && (
        <div className="text-center py-5 text-dim text-[13px] after:content-[''] after:inline-block after:w-3.5 after:h-3.5 after:border-2 after:border-border after:border-t-accent after:rounded-full after:ml-2 after:align-middle after:animate-spin">검색중</div>
      )}
      {error && <div className="text-center py-[30px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]"><p>검색 중 오류가 발생했어요</p></div>}
      {!loading && !error && isSuccess && results.length === 0 && <div className="text-center py-[30px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]"><p>검색 결과가 없어요</p></div>}
      {!loading && results.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          {results.map((item, i) => (
            <div key={i} className="py-2.5 border-b border-border">
              <div className="font-semibold text-sm mb-1">{item.word}</div>
              {(item.sense || []).map((s, j) => (
                <div key={j} className="flex gap-2.5 items-start py-1">
                  <div className="flex-1 text-[13px] text-dim">{s.definition}</div>
                  <button className={BTN_SMALL_SECONDARY} onClick={() => onAddWord({ term: item.word, meaning: s.definition })}>저장</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
