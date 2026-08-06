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
        <div className="empty-state">
          <div className="icon">📖</div>
          <h3>아직 저장한 단어가 없어요</h3>
          <p>사전 탭에서 단어를 검색하고 저장해보세요</p>
        </div>
      ) : (
        <div className="quotes-list">
          {sorted.map((w) => (
            <div key={w.id} className="quote-card">
              <div className="quote-text">{w.term}</div>
              <div className="quote-source">{w.meaning}</div>
              <div className="quote-actions">
                <button className="btn btn-small btn-danger" onClick={() => onDeleteWord(w.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
