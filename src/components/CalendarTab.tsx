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


function WeekRow({ week, bars, todayStr, onBookClick }: {
  week: (Date | null)[]
  bars: EventBar[]
  todayStr: string
  onBookClick: (id: string) => void
}) {
  return (
    <div className="cal-week">
      <div className="cal-day-row">
        {week.map((day, di) => {
          const isToday = day && toDateStr(day) === todayStr
          return (
            <div key={di} className={`cal-day${isToday ? ' cal-today' : ''}${!day ? ' cal-empty' : ''}`}>
              {day && <span className="cal-day-num">{day.getDate()}</span>}
            </div>
          )
        })}
      </div>
      {bars.length > 0 && (
        <div className="cal-events-row">
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
      className="cal-event-bar"
      style={{ gridColumn: `${startCol + 1} / span ${span}`, gridRow: lane + 1 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={book.title}
    >
      {isFirst && book.cover
        ? <img src={book.cover} className="cal-event-cover" alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        : isFirst ? <span className="cal-event-emoji">📕</span> : null
      }
      <span className="cal-event-title">{title}</span>
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
    <div className="calendar-wrap">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-nav-title">{year}년 {MONTH_NAMES[month]}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-table">
        <div className="cal-dow-row">
          {DOW_LABELS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
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
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <div className="icon">📅</div>
          <h3>읽은 책이 없어요</h3>
          <p style={{ marginTop: '8px', fontSize: '14px' }}>책을 추가하고 시작 날짜를 등록하면 달력에 표시돼요</p>
        </div>
      )}
    </div>
  )
}
