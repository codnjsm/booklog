import { useMemo, useState } from 'react'
import type { Book } from '../types'
import { useAppUI } from '../contexts/AppUIContext'
import { IconBooks } from './layout/icons'
import Stars from './Stars'

interface Props {
  books: Book[]
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

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

/**
 * 그 책을 읽은 날짜들.
 * 읽은 날짜를 고른 책은 그 날짜만, 고른 기록이 없는 과거 데이터는
 * 시작~종료(읽는중이면 오늘)까지를 다 읽은 것으로 본다 — 예전 달력이 그 기간에 막대를 그렸던 것과 같다.
 */
function readDaysOf(book: Book, todayStr: string): string[] {
  if (book.readDates?.length) return book.readDates

  const start = isoToLocalDateStr(book.startedAt || book.createdAt)
  const end = book.finishedAt ? isoToLocalDateStr(book.finishedAt) : todayStr
  if (start > end) return [start]

  const days: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (cur <= last) {
    days.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

const ARROW =
  'w-[30px] h-[30px] sm:w-9 sm:h-9 flex items-center justify-center bg-transparent border-none text-dim text-lg sm:text-2xl leading-none cursor-pointer rounded-lg flex-shrink-0 transition-colors duration-150 hover:text-ink'

function Cover({ book, className }: { book: Book; className: string }) {
  const [err, setErr] = useState(false)
  if (book.cover && !err) {
    return (
      <img
        src={book.cover}
        alt=""
        onError={() => setErr(true)}
        className={`${className} object-cover rounded border border-border flex-shrink-0`}
      />
    )
  }
  return (
    <div
      className={`${className} rounded bg-surface2 border border-border flex-shrink-0 flex items-center justify-center px-0.5`}
    >
      <span className="text-[8px] leading-tight text-dim text-center line-clamp-3">{book.title}</span>
    </div>
  )
}

export default function CalendarTab({ books }: Props) {
  const { openBookDetail } = useAppUI()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const todayStr = toDateStr(now)
  const weeks = getWeeks(year, month)

  // 이 달의 '읽은 날' → 그 날 읽은 책들
  const byDate = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    const map = new Map<string, Book[]>()
    for (const book of books) {
      if (book.status === 'wishlist') continue
      for (const day of readDaysOf(book, todayStr)) {
        if (!day.startsWith(prefix)) continue
        const list = map.get(day)
        if (!list) map.set(day, [book])
        else if (!list.includes(book)) list.push(book)
      }
    }
    return map
  }, [books, year, month, todayStr])

  // 날짜를 고르면 그 날, 안 골랐으면 그 달에 읽은 책 전체. 별점 높은 순.
  const listBooks = useMemo(() => {
    const picked = selectedDate ? (byDate.get(selectedDate) ?? []) : [...new Set([...byDate.values()].flat())]
    return [...picked].sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title))
  }, [byDate, selectedDate])

  const goMonth = (delta: number) => {
    setSelectedDate(null)
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  const listTitle = selectedDate
    ? `${Number(selectedDate.slice(5, 7))}월 ${Number(selectedDate.slice(8, 10))}일에 읽은 책`
    : `${MONTH_NAMES[month]}에 읽은 책`

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <button className={ARROW} onClick={() => goMonth(-1)} aria-label="이전 달">
          ‹
        </button>
        <span className="font-sans text-base font-bold text-center flex-1">
          {year}년 {MONTH_NAMES[month]}
        </span>
        <button className={ARROW} onClick={() => goMonth(1)} aria-label="다음 달">
          ›
        </button>
      </div>

      <div className="text-xs sm:text-[13px] text-dim mb-1">
        읽은 날 · <span className="text-ink font-semibold">{byDate.size}일</span>
      </div>

      <div className="grid grid-cols-7">
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] sm:text-xs text-dim font-medium">
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            if (!day) return <div key={di} className="h-11 sm:h-12" />
            const dateStr = toDateStr(day)
            const isRead = byDate.has(dateStr)
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === todayStr
            return (
              <div key={di} className="flex items-center justify-center h-11 sm:h-12 px-0.5">
                <button
                  type="button"
                  disabled={!isRead}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[13px] sm:text-sm rounded-[9px] transition-colors duration-100 ${
                    isSelected
                      ? 'bg-accent text-white font-semibold cursor-pointer'
                      : isRead
                        ? 'bg-transparent text-ink font-semibold cursor-pointer hover:bg-surface2'
                        : isToday
                          ? 'bg-transparent text-accent font-semibold cursor-default'
                          : 'bg-transparent text-dim cursor-default'
                  }`}
                >
                  {isRead && !isSelected ? (
                    // 읽은 날은 제목·인용구와 같은 형광펜 문법으로 그어준다.
                    // leading-none이 없으면 줄 높이 탓에 형광이 숫자 아래로 떨어져 블록처럼 보인다.
                    <span className="leading-none bg-[linear-gradient(transparent_50%,var(--highlight)_50%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone] px-[3px] pb-[1px]">
                      {day.getDate()}
                    </span>
                  ) : (
                    day.getDate()
                  )}
                </button>
              </div>
            )
          })}
        </div>
      ))}

      <div className="mt-6">
        <div className="flex items-baseline gap-2 mb-2.5">
          <h3 className="text-[13px] font-semibold text-ink">{listTitle}</h3>
          <span className="font-mono text-xs sm:text-[13px] text-dim">{listBooks.length}권</span>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="ml-auto text-xs sm:text-[13px] font-medium px-2.5 py-1 rounded-full bg-accentsoft text-accent border-none cursor-pointer hover:opacity-80"
            >
              이 달 전체 보기
            </button>
          )}
        </div>

        {listBooks.length === 0 ? (
          <div className="text-center py-[50px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
              <IconBooks size={22} />
            </div>
            <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">읽은 기록이 없어요</h3>
            <p className="text-xs sm:text-[13px]">책에 읽은 날짜를 등록하면 달력에 표시돼요</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl">
            {listBooks.map((book, i) => (
              <button
                key={book.id}
                onClick={() => openBookDetail(book.id)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 border-0 border-b border-surface2 last:border-b-0 bg-transparent text-left cursor-pointer transition-colors duration-150 hover:bg-surface2"
              >
                <span className="font-mono text-xs sm:text-[13px] text-dim w-3 flex-shrink-0">{i + 1}</span>
                <Cover book={book} className="w-9 h-[50px]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{book.title}</div>
                  <div className="text-xs sm:text-[13px] text-dim truncate mt-0.5">{book.author || '저자 미상'}</div>
                </div>
                <span className="text-ink flex-shrink-0">
                  <Stars rating={book.rating} size={12} showEmpty />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
