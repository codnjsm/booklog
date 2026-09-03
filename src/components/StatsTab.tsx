import { useState } from 'react'
import type { Book, Quote } from '../types'

interface Props { books: Book[]; quotes: Quote[]; goal?: number; onSetGoal: (n: number) => void }

const FORM_INPUT = "w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-base font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent"
const BTN = "bg-ink text-bg border-none px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:opacity-90"
const BTN_SECONDARY = "bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"
const BTN_SMALL_SECONDARY = "bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"

function StatCard({ label, value, sub, highlight }: { label: string; value: number | string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded-[10px] py-3.5 px-4 sm:py-[18px] sm:px-5">
      <div className={`text-[22px] sm:text-[28px] font-bold font-sans ${highlight ? 'text-accent' : 'text-ink'}`}>{value}</div>
      <div className="text-xs text-dim uppercase tracking-[0.05em] mt-1">{label}</div>
      {sub && <div className="text-[11px] text-dim mt-0.5">{sub}</div>}
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
      <div className="bg-surface border border-border rounded-[10px] p-4 sm:p-[22px] mb-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold text-dim uppercase tracking-[0.05em] flex-shrink-0">{thisYear}년 독서 목표</div>
            <div className="flex-1" />
            <input type="number" value={input} onChange={(e) => setInput(e.target.value)} placeholder="목표 권수 입력" min={1}
              className={`${FORM_INPUT} w-[140px] h-[42px] box-border`}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()} autoFocus />
            <button className={`${BTN} whitespace-nowrap h-[42px]`} onClick={handleSaveGoal}>저장</button>
            <button className={`${BTN_SECONDARY} whitespace-nowrap h-[42px]`} onClick={() => setEditing(false)}>취소</button>
          </div>
        ) : (
          <div>
            <div className={`flex justify-between items-center ${goal ? 'mb-3.5' : ''}`}>
              <div className="text-base font-semibold text-dim uppercase tracking-[0.05em]">{thisYear}년 독서 목표</div>
              <button className={BTN_SMALL_SECONDARY} onClick={() => { setInput(String(goal || '')); setEditing(true) }}>
                {goal ? '수정' : '목표 설정'}
              </button>
            </div>
            {goal ? (
              <div>
                <div className="flex justify-between items-baseline mb-2.5">
                  <span className="text-[13px] text-dim">
                    <span className="font-semibold text-ink">{doneThisYear}</span> / {goal}권
                  </span>
                  <span className={`text-[13px] ${pct >= 100 ? 'text-accent font-semibold' : 'text-dim'}`}>{pct}%</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-[width] duration-[400ms] ease-in-out ${'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ) : (
              <div className="text-dim text-[13px] mt-2">올해 읽고 싶은 책 권수를 설정해보세요.</div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 sm:gap-3 mb-6">
        <StatCard label="전체 책" value={books.length} />
        <StatCard label="완독" value={done.length} highlight />
        <StatCard label="읽는중" value={books.filter((b) => b.status === 'reading').length} />
        <StatCard label="위시리스트" value={books.filter((b) => b.status === 'wishlist').length} />
        <StatCard label="모은 문장" value={quotes.length} />
        <StatCard label="평균 별점" value={avgRating ? avgRating.toFixed(1) : '–'} sub={`${rated.length}권 평가`} />
      </div>
      <div className="bg-surface border border-border rounded-[10px] p-4 sm:p-[22px] mb-4">
        <div className="text-base font-semibold mb-4 text-dim uppercase tracking-[0.05em]">최근 12개월 완독 추이</div>
        <div className="flex gap-1.5 items-end h-[100px] sm:h-[140px] py-2">
          {Object.entries(monthCounts).map(([key, v]) => {
            const isCurrent = key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-[4px] min-h-1 transition-all duration-300 relative hover:opacity-80" style={{
                  height: `${(v / maxMonth) * 100}%`,
                  background: isCurrent
                    ? 'linear-gradient(180deg, var(--accent), var(--accent-hover))'
                    : 'var(--border)',
                }}>
                  {v > 0 && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] text-ink font-semibold">{v}</div>}
                </div>
                <div className={`text-[10px] ${isCurrent ? 'font-bold text-ink' : 'text-dim'}`}>
                  {parseInt(key.split('-')[1])}월
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-[11px] text-dim text-center mt-2">완독한 책의 '완독 날짜' 기준</div>
      </div>
      {topAuthors.length > 0 && (
        <div className="bg-surface border border-border rounded-[10px] p-4 sm:p-[22px] mb-4">
          <div className="text-base font-semibold mb-4 text-dim uppercase tracking-[0.05em]">가장 많이 읽은 저자</div>
          <div className="flex flex-col gap-2">
            {topAuthors.map(([a, c]) => (
              <div key={a} className="flex justify-between items-center py-[7px] px-2.5 sm:py-2 sm:px-3 bg-bg rounded-md text-[13px]">
                <span>{a}</span><span className="font-semibold [font-variant-numeric:tabular-nums]">{c}권</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {topTags.length > 0 && (
        <div className="bg-surface border border-border rounded-[10px] p-4 sm:p-[22px] mb-4">
          <div className="text-base font-semibold mb-4 text-dim uppercase tracking-[0.05em]">자주 쓴 태그</div>
          <div className="flex flex-col gap-2">
            {topTags.map(([t, c]) => (
              <div key={t} className="flex justify-between items-center py-[7px] px-2.5 sm:py-2 sm:px-3 bg-bg rounded-md text-[13px]">
                <span>#{t}</span><span className="font-semibold [font-variant-numeric:tabular-nums]">{c}회</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
