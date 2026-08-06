import { useState, useRef } from 'react'
import type { Word } from '../types'

interface DictSense { definition: string; pos?: string }
interface DictItem { word: string; sense?: DictSense[] }
interface DictResponse { channel?: { item?: DictItem[] } }

interface Props {
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
}

export default function DictTab({ onAddWord }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DictItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (q: string) => {
    if (q.length < 1) { setResults([]); setSearched(false); return }
    setLoading(true); setError(false)
    try {
      const res = await fetch(`/api/koreanDictSearch?query=${encodeURIComponent(q)}`)
      const data = await res.json() as DictResponse
      setResults(data.channel?.item || []); setSearched(true)
    } catch { setError(true) } finally { setLoading(false) }
  }

  const handleInput = (v: string) => {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 400)
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <input type="text" placeholder="뜻을 찾을 단어 입력" value={query} onChange={(e) => handleInput(e.target.value)} autoComplete="off" autoFocus />
        </div>
      </div>
      {loading && <div className="loading">검색중</div>}
      {error && <div className="empty-state" style={{ padding: '30px 20px' }}><p>검색 중 오류가 발생했어요</p></div>}
      {!loading && !error && searched && results.length === 0 && <div className="empty-state" style={{ padding: '30px 20px' }}><p>검색 결과가 없어요</p></div>}
      {!loading && results.length > 0 && (
        <div className="dict-results">
          {results.map((item, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{item.word}</div>
              {(item.sense || []).map((s, j) => (
                <div key={j} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '4px 0' }}>
                  <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-dim)' }}>{s.definition}</div>
                  <button className="btn btn-small btn-secondary" onClick={() => onAddWord({ term: item.word, meaning: s.definition })}>저장</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
