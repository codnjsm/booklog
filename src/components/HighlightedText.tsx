import type { Quote } from '../types'

type Range = { start: number; end: number }

// 겹치거나 맞닿은 구간은 하나로 합친다. 항상 시작 위치 순으로 정렬해서 돌려준다.
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  const merged: Range[] = []
  for (const cur of sorted) {
    const last = merged[merged.length - 1]
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end)
    else merged.push({ ...cur })
  }
  return merged
}

interface Props { text: string; highlights?: Quote['highlights'] }

// 문장 중 사용자가 표시한 구간에만 형광펜을 칠한다.
// 문장을 나중에 고쳐도 깨지지 않도록 인덱스는 항상 현재 길이에 맞춰 자른다.
export default function HighlightedText({ text, highlights }: Props) {
  const ranges = mergeRanges(
    (highlights ?? []).map((r) => {
      const start = Math.max(0, Math.min(r.start, text.length))
      return { start, end: Math.max(start, Math.min(r.end, text.length)) }
    })
  )
  if (ranges.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((r, i) => {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start))
    parts.push(
      <span key={i} className="bg-[linear-gradient(transparent_56%,var(--highlight)_56%)]">{text.slice(r.start, r.end)}</span>
    )
    cursor = r.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))

  return <>{parts}</>
}
