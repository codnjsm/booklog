import { useState, useRef } from 'react'
import Modal from './Modal'
import type { BookPrefill } from '../../types'

interface NaverItem {
  title: string
  author: string
  image: string
  pubdate: string
  isbn: string
}

interface Props { onClose: () => void; onSelectBook: (p: BookPrefill) => void; onManualEntry: () => void }

export default function AddBookModal({ onClose, onSelectBook, onManualEntry }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NaverItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); setSearched(false); return }
    setLoading(true); setError(false)
    try {
      const res = await fetch(`/api/naverBookSearch?query=${encodeURIComponent(q)}`)
      const data = await res.json() as { items?: NaverItem[] }
      setResults(data.items || []); setSearched(true)
    } catch { setError(true) } finally { setLoading(false) }
  }

  const handleInput = (v: string) => {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 400)
  }

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '')

  return (
    <Modal onClose={onClose}>
      <div className="modal">
        <div className="modal-header"><h3>책 추가</h3><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-group">
            <input type="text" placeholder="제목 또는 저자 입력" value={query} onChange={(e) => handleInput(e.target.value)} autoFocus autoComplete="off" />
          </div>
          {loading && <div className="loading">검색중</div>}
          {error && <div className="empty-state" style={{ padding: '30px 20px' }}><p>검색 중 오류가 발생했어요.<br />직접 입력해보세요.</p></div>}
          {!loading && results.length > 0 && (
            <div className="search-results">
              {results.map((item, i) => {
                const title = stripHtml(item.title)
                const author = stripHtml(item.author).replace(/\^/g, ', ')
                const year = item.pubdate ? parseInt(item.pubdate.slice(0, 4)) : undefined
                return (
                  <div key={i} className="search-result" onClick={() => onSelectBook({ title, author, cover: item.image, year })}>
                    {item.image
                      ? <img src={item.image} alt={title} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      : <div style={{ width: '50px', height: '70px', background: 'var(--surface-2)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📕</div>
                    }
                    <div className="search-result-info">
                      <div className="search-result-title">{title}</div>
                      <div className="search-result-author">{author}</div>
                      {year && <div className="search-result-year">{year}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!loading && !error && searched && results.length === 0 && <div className="empty-state" style={{ padding: '30px 20px' }}><p>검색 결과가 없어요</p></div>}
          <div style={{ textAlign: 'center', margin: '20px 0', color: 'var(--text-dim)', fontSize: '12px' }}>— 또는 —</div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onManualEntry}>직접 입력하기</button>
        </div>
      </div>
    </Modal>
  )
}
