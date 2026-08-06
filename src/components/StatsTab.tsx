import { useState } from 'react'
import type { Book, Quote } from '../types'

interface Props { books: Book[]; quotes: Quote[]; goal?: number; onSetGoal: (n: number) => void }

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function StatsTab({ books, quotes, goal, onSetGoal }: Props) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const done = books.filter((b) => b.status === 'done')
  const rated = books.filter((b) => b.rating > 0)
  const avgRating = rated.length ? rated.reduce((s, b) => s + b.rating, 0) / rated.length : 0

  const thisYear = new Date().getFullYear()
  const doneThisYear = done.filter((b) => b.finishedAt?.startsWith(String(thisYear))).length

  const now = new Date()
  const monthCounts: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthCounts[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
  }
  done.forEach((b) => { if (b.finishedAt) { const k = b.finishedAt.slice(0, 7); if (k in monthCounts) monthCounts[k]++ } })
  const maxMonth = Math.max(1, ...Object.values(monthCounts))

  const authorCounts: Record<string, number> = {}
  done.forEach((b) => { if (b.author) authorCounts[b.author] = (authorCounts[b.author] || 0) + 1 })
  const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const tagCounts: Record<string, number> = {}
  quotes.forEach((q) => (q.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1 }))
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const handleSaveGoal = () => {
    const n = parseInt(input)
    if (n > 0) onSetGoal(n)
    setEditing(false)
  }

  const pct = goal ? Math.min(100, Math.round((doneThisYear / goal) * 100)) : 0

  return (
    <div>
      <div className="chart-section" style={{ marginBottom: '16px' }}>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="chart-title" style={{ marginBottom: 0, flexShrink: 0 }}>{thisYear}년 독서 목표</div>
            <div style={{ flex: 1 }} />
            <input type="number" value={input} onChange={(e) => setInput(e.target.value)} placeholder="목표 권수 입력" min={1} style={{ width: '140px', fontSize: '16px', height: '42px', boxSizing: 'border-box' }} onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()} autoFocus />
            <button className="btn" onClick={handleSaveGoal} style={{ whiteSpace: 'nowrap', height: '42px' }}>저장</button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)} style={{ whiteSpace: 'nowrap', height: '42px' }}>취소</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: goal ? '14px' : 0 }}>
              <div className="chart-title" style={{ marginBottom: 0 }}>{thisYear}년 독서 목표</div>
              <button className="btn btn-secondary btn-small" onClick={() => { setInput(String(goal || '')); setEditing(true) }}>
                {goal ? '수정' : '목표 설정'}
              </button>
            </div>
            {goal ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{doneThisYear}</span> / {goal}권
                  </span>
                  <span style={{ fontSize: '13px', color: pct >= 100 ? 'var(--success)' : 'var(--text-dim)', fontWeight: pct >= 100 ? 600 : undefined }}>{pct}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--accent)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginTop: '8px' }}>올해 읽고 싶은 책 권수를 설정해보세요.</div>
            )}
          </div>
        )}
      </div>

      <div className="stats-grid">
        <StatCard label="전체 책" value={books.length} />
        <StatCard label="완독" value={done.length} />
        <StatCard label="읽는중" value={books.filter((b) => b.status === 'reading').length} />
        <StatCard label="위시리스트" value={books.filter((b) => b.status === 'wishlist').length} />
        <StatCard label="모은 문장" value={quotes.length} />
        <StatCard label="평균 별점" value={avgRating ? avgRating.toFixed(1) : '–'} sub={`${rated.length}권 평가`} />
      </div>
      <div className="chart-section">
        <div className="chart-title">최근 12개월 완독 추이</div>
        <div className="month-bars">
          {Object.entries(monthCounts).map(([key, v]) => {
            const isCurrent = key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            return (
              <div key={key} className="month-bar-col">
                <div className="month-bar" style={{
                  height: `${(v / maxMonth) * 100}%`,
                  background: isCurrent
                    ? 'linear-gradient(180deg, var(--accent), var(--accent-hover))'
                    : 'var(--border)',
                }}>
                  {v > 0 && <div className="month-bar-value">{v}</div>}
                </div>
                <div className="month-label" style={{ fontWeight: isCurrent ? 700 : undefined, color: isCurrent ? 'var(--text)' : undefined }}>
                  {parseInt(key.split('-')[1])}월
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '8px' }}>완독한 책의 '완독 날짜' 기준</div>
      </div>
      {topAuthors.length > 0 && (
        <div className="chart-section">
          <div className="chart-title">가장 많이 읽은 저자</div>
          <div className="top-list">
            {topAuthors.map(([a, c]) => <div key={a} className="top-list-item"><span>{a}</span><span className="count">{c}권</span></div>)}
          </div>
        </div>
      )}
      {topTags.length > 0 && (
        <div className="chart-section">
          <div className="chart-title">자주 쓴 태그</div>
          <div className="top-list">
            {topTags.map(([t, c]) => <div key={t} className="top-list-item"><span>#{t}</span><span className="count">{c}회</span></div>)}
          </div>
        </div>
      )}
    </div>
  )
}
