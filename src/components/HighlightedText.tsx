import type { Quote, HighlightColor } from '../types'

type Range = { start: number; end: number; color?: HighlightColor }

export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string }[] = [
  { id: 'lime', label: '연두' },
  { id: 'pink', label: '핑크' },
  { id: 'sky', label: '하늘' },
  { id: 'mint', label: '민트' },
  { id: 'lavender', label: '라벤더' },
]

// 겹치거나 맞닿은 구간은 하나로 합친다. 단, 색이 다르면 서로 다른 형광펜으로 보고 합치지 않는다.
// (색이 다른 구간끼리 실제로 겹치는 경우의 렌더링은 HighlightedText가 따로 처리한다.)
// 항상 시작 위치 순으로 정렬해서 돌려준다.
export function mergeRanges(ranges: Range[]): Range[] {
  const groups = new Map<string, Range[]>()
  for (const r of ranges) {
    if (r.end <= r.start) continue
    const key = r.color ?? 'lime'
    const list = groups.get(key)
    if (list) list.push(r)
    else groups.set(key, [r])
  }
  const merged: Range[] = []
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.start - b.start)
    const out: Range[] = []
    for (const cur of sorted) {
      const last = out[out.length - 1]
      if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end)
      else out.push({ ...cur })
    }
    merged.push(...out)
  }
  return merged.sort((a, b) => a.start - b.start)
}

/**
 * ranges에서 cut 구간을 도려낸다. 걸쳐 있는 구간은 앞뒤 남은 부분으로 쪼개지고, 완전히 덮이면 사라진다.
 * 같은 자리를 다른 색으로 다시 칠할 때 쓴다 — 지우지 않고 덧칠하면 색만 다른 구간이 겹쳐 쌓이고,
 * 렌더는 먼저 시작한 구간을 우선하므로 처음 칠한 색이 계속 이겨서 색이 안 바뀐 것처럼 보인다.
 */
export function subtractRange(ranges: Range[], cut: { start: number; end: number }): Range[] {
  const out: Range[] = []
  for (const r of ranges) {
    if (r.end <= cut.start || r.start >= cut.end) {
      out.push(r)
      continue
    }
    if (r.start < cut.start) out.push({ ...r, end: cut.start })
    if (r.end > cut.end) out.push({ ...r, start: cut.end })
  }
  return out
}

interface Props {
  text: string
  highlights?: Quote['highlights']
}

// 문장 중 사용자가 표시한 구간에만 형광펜을 칠한다.
// 문장을 나중에 고쳐도 깨지지 않도록 인덱스는 항상 현재 길이에 맞춰 자른다.
export default function HighlightedText({ text, highlights }: Props) {
  const ranges = mergeRanges(
    (highlights ?? []).map((r) => {
      const start = Math.max(0, Math.min(r.start, text.length))
      return { start, end: Math.max(start, Math.min(r.end, text.length)), color: r.color }
    }),
  )
  if (ranges.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((r, i) => {
    // 색이 다른 구간끼리 겹치면 먼저 그려진(=앞서 시작한) 구간을 우선한다.
    const start = Math.max(r.start, cursor)
    if (start >= r.end) return
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <span
        key={i}
        style={{ '--hl-color': `var(--highlight-${r.color ?? 'lime'})` } as React.CSSProperties}
        className="bg-[linear-gradient(transparent_56%,var(--hl-color)_56%)]"
      >
        {text.slice(start, r.end)}
      </span>,
    )
    cursor = r.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))

  return <>{parts}</>
}
