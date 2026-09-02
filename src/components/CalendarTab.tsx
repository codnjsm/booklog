import { useState } from 'react'
import type { Book } from '../types'

interface Props { books: Book[]; onBookClick: (id: string) => void }

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isoToLocalDateStr(iso: string) {
  return toDateStr(new Date(iso))
}

function dow(date: Date) {
  return (date.getDay() + 6) % 7
}

function getWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const cells: (Date | null)[] = []
  for (let i = 0; i < dow(first); i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

interface EventBar {
  book: Book
  startCol: number
  span: number
  isFirst: boolean
  lane: number
}

function overlaps(a: { startCol: number; span: number }, b: { startCol: number; span: number }) {
  return !(a.startCol + a.span <= b.startCol || b.startCol + b.span <= a.startCol)
}

function getBarsForWeek(books: Book[], weekDays: (Date | null)[]): EventBar[] {
  const validDays = weekDays.filter(Boolean) as Date[]
  if (validDays.length === 0) return []

  const weekStartStr = toDateStr(validDays[0])
  const weekEndStr = toDateStr(validDays[validDays.length - 1])
  const todayStr = toDateStr(new Date())

  const rawBars: Omit<EventBar, 'lane'>[] = []

  for (const book of books) {
    if (book.status === 'wishlist') continue
    const bookStart = isoToLocalDateStr(book.startedAt || book.createdAt)
    const bookEnd = book.finishedAt
      ? isoToLocalDateStr(book.finishedAt)
      : todayStr

    if (bookStart > weekEndStr || bookEnd < weekStartStr) continue

    const barStart = bookStart < weekStartStr ? weekStartStr : bookStart
    const barEnd = bookEnd > weekEndStr ? weekEndStr : bookEnd

    const startCol = dow(new Date(barStart + 'T12:00:00'))
    const endCol = dow(new Date(barEnd + 'T12:00:00'))

    rawBars.push({ book, startCol, span: endCol - startCol + 1, isFirst: barStart === bookStart })
  }

  // Assign lanes: pack non-overlapping bars into the same row
  const bars: EventBar[] = []
  for (const raw of rawBars) {
    let lane = 0
    while (bars.filter(b => b.lane === lane).some(b => overlaps(b, raw))) lane++
    bars.push({ ...raw, lane })
  }

  return bars
}

const DIVIDER_BG = 'linear-gradient(to right, transparent calc(100%/7 - 1px), var(--border) calc(100%/7 - 1px), var(--border) calc(100%/7), transparent calc(100%/7), transparent calc(200%/7 - 1px), var(--border) calc(200%/7 - 1px), var(--border) calc(200%/7), transparent calc(200%/7), transparent calc(300%/7 - 1px), var(--border) calc(300%/7 - 1px), var(--border) calc(300%/7), transparent calc(300%/7), transparent calc(400%/7 - 1px), var(--border) calc(400%/7 - 1px), var(--border) calc(400%/7), transparent calc(400%/7), transparent calc(500%/7 - 1px), var(--border) calc(500%/7 - 1px), var(--border) calc(500%/7), transparent calc(500%/7), transparent calc(600%/7 - 1px), var(--border) calc(600%/7 - 1px), var(--border) calc(600%/7), transparent calc(600%/7))'

function WeekRow({ week, bars, todayStr, onBookClick }: {
  week: (Date | null)[]
  bars: EventBar[]
  todayStr: string
  onBookClick: (id: string) => void
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="grid grid-cols-7">
        {week.map((day, di) => {
          const isToday = day && toDateStr(day) === todayStr
          return (
            <div key={di} className={`h-[52px] px-1 py-1.5 sm:px-3 sm:py-2.5 border-r border-border last:border-r-0 flex flex-col ${!day ? 'bg-bg opacity-40' : ''}`}>
              {day && (
                <span className={isToday
                  ? 'w-5 h-5 sm:w-[26px] sm:h-[26px] bg-accent text-bg rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs'
                  : 'text-[10px] sm:text-[13px] text-dim font-medium'}>
                  {day.getDate()}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {bars.length > 0 && (
        <div className="grid grid-cols-7 [grid-auto-rows:22px] sm:[grid-auto-rows:34px] px-[1px] sm:px-0.5 pb-0.5 sm:pb-1 gap-y-0.5 sm:gap-y-[3px] pointer-events-none" style={{ background: DIVIDER_BG }}>
          {bars.map((bar, bi) => (
            <BookBar key={bar.book.id + '-' + bi} bar={bar} onClick={() => onBookClick(bar.book.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function BookBar({ bar, onClick }: { bar: EventBar; onClick: () => void }) {
  const { book, startCol, span, isFirst, lane } = bar
  const title = book.title.length > 18 ? book.title.slice(0, 16) + '…' : book.title

  return (
    <div
      className="flex items-center gap-0.5 sm:gap-1.5 bg-[var(--accent-soft)] border border-border rounded-[3px] sm:rounded-[5px] px-1 sm:px-2 py-1 cursor-pointer overflow-hidden transition-colors duration-150 mx-[1px] sm:mx-0.5 pointer-events-auto hover:bg-surface2 hover:border-accent"
      style={{ gridColumn: `${startCol + 1} / span ${span}`, gridRow: lane + 1 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={book.title}
    >
      {isFirst && book.cover
        ? <img src={book.cover} className="w-3 h-4 sm:w-5 sm:h-7 object-cover rounded-sm flex-shrink-0" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        : isFirst ? <span className="text-xs sm:text-base flex-shrink-0 leading-none">📕</span> : null
      }
      <span className="text-[11px] sm:text-[13px] text-ink whitespace-nowrap overflow-hidden text-ellipsis font-medium">{title}</span>
    </div>
  )
}

export default function CalendarTab({ books, onBookClick }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const todayStr = toDateStr(now)
  const weeks = getWeeks(year, month)

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const hasBooks = books.some(b => b.status !== 'wishlist' && (b.startedAt || b.createdAt))

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <button className="bg-surface border border-border text-ink w-[30px] h-[30px] sm:w-9 sm:h-9 rounded-lg cursor-pointer text-base sm:text-xl leading-none flex items-center justify-center transition-all duration-150 flex-shrink-0 hover:bg-surface2" onClick={prevMonth}>‹</button>
        <span className="font-sans text-base font-bold text-center flex-1">{year}년 {MONTH_NAMES[month]}</span>
        <button className="bg-surface border border-border text-ink w-[30px] h-[30px] sm:w-9 sm:h-9 rounded-lg cursor-pointer text-base sm:text-xl leading-none flex items-center justify-center transition-all duration-150 flex-shrink-0 hover:bg-surface2" onClick={nextMonth}>›</button>
      </div>

      <div className="border border-border rounded-[10px] overflow-hidden bg-surface w-full [container-type:inline-size]">
        <div className="grid grid-cols-7 border-b border-border">
          {DOW_LABELS.map((d) => <div key={d} className="py-1.5 sm:py-2.5 text-center text-[10px] sm:text-xs text-dim font-semibold tracking-normal sm:tracking-[0.05em]">{d}</div>)}
        </div>

        {weeks.map((week, wi) => (
          <WeekRow
            key={wi}
            week={week}
            bars={getBarsForWeek(books, week)}
            todayStr={todayStr}
            onBookClick={onBookClick}
          />
        ))}
      </div>

      {!hasBooks && (
        <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px] mt-6">
          <div className="text-[40px] mb-3 opacity-60">📅</div>
          <h3 className="font-sans text-ink mb-1.5 text-[15px]">읽은 책이 없어요</h3>
          <p className="mt-2 text-sm">책을 추가하고 시작 날짜를 등록하면 달력에 표시돼요</p>
        </div>
      )}
    </div>
  )
}
