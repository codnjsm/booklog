import { useState } from 'react'

interface Props {
  selected: string[] // YYYY-MM-DD[]
  onChange: (dates: string[]) => void
  max?: string // YYYY-MM-DD
}

const DOW_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

const ARROW =
  'w-7 h-7 flex items-center justify-center bg-transparent border-none text-dim text-base leading-none cursor-pointer rounded-md hover:text-ink hover:bg-surface2'

export default function DateMultiPicker({ selected, onChange, max }: Props) {
  const todayStr = toDateStr(new Date())
  const maxStr = max ?? todayStr
  const initial = selected.length ? new Date(selected[selected.length - 1] + 'T12:00:00') : new Date()
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth())

  const selectedSet = new Set(selected)
  const weeks = getWeeks(year, month)

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  const toggle = (dateStr: string) => {
    onChange(selectedSet.has(dateStr) ? selected.filter((d) => d !== dateStr) : [...selected, dateStr].sort())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium text-ink">
          {year}년 {MONTH_NAMES[month]}
        </span>
        <div className="flex">
          <button type="button" onClick={prevMonth} className={ARROW} aria-label="이전 달">
            ‹
          </button>
          <button type="button" onClick={nextMonth} className={ARROW} aria-label="다음 달">
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] text-dim">
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            if (!day) return <div key={di} className="h-8 sm:h-9" />
            const dateStr = toDateStr(day)
            const isSelected = selectedSet.has(dateStr)
            const isFuture = dateStr > maxStr
            const isToday = dateStr === todayStr
            return (
              <div key={di} className="flex items-center justify-center h-8 sm:h-9 px-0.5">
                <button
                  type="button"
                  disabled={isFuture}
                  onClick={() => toggle(dateStr)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-xs sm:text-[13px] rounded-[7px] transition-colors duration-100 ${
                    isSelected
                      ? 'bg-transparent text-ink font-semibold cursor-pointer'
                      : isFuture
                        ? 'bg-transparent text-border cursor-not-allowed'
                        : isToday
                          ? 'bg-transparent text-accent font-semibold cursor-pointer hover:bg-surface2'
                          : 'bg-transparent text-ink cursor-pointer hover:bg-surface2'
                  }`}
                >
                  {isSelected ? (
                    // 고른 날은 형광펜으로 그어준다. leading-none이 없으면 줄 높이 탓에 숫자 아래로 떨어진다.
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
    </div>
  )
}
