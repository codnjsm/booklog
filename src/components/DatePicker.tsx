import { useState, useEffect } from 'react'

interface Props {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  max?: string // YYYY-MM-DD
}

const SELECT =
  'flex-1 bg-bg border border-border text-ink rounded-lg py-[9px] px-2.5 text-base font-sans cursor-pointer outline-none appearance-none focus:border-accent'

export default function DatePicker({ value, onChange, max }: Props) {
  const parse = (v: string) => {
    const parts = v ? v.split('-') : ['', '', '']
    return {
      y: parts[0] ? String(Number(parts[0])) : '',
      m: parts[1] ? String(Number(parts[1])) : '',
      d: parts[2] ? String(Number(parts[2])) : '',
    }
  }

  const [year, setYear] = useState(() => parse(value).y)
  const [month, setMonth] = useState(() => parse(value).m)
  const [day, setDay] = useState(() => parse(value).d)

  // Sync when external value changes (e.g. reset)
  useEffect(() => {
    const p = parse(value)
    setYear(p.y)
    setMonth(p.m)
    setDay(p.d)
  }, [value])

  const maxDate = max ? max.split('-').map(Number) : null
  const today = new Date()
  const maxYear = maxDate ? maxDate[0] : today.getFullYear()

  const years = Array.from({ length: 20 }, (_, i) => maxYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => {
    if (!maxDate || Number(year) !== maxDate[0]) return true
    return m <= maxDate[1]
  })
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((d) => {
    if (!maxDate || Number(year) !== maxDate[0] || Number(month) !== maxDate[1]) return true
    return d <= maxDate[2]
  })

  const emit = (y: string, m: string, d: string) => {
    if (y && m && d) {
      onChange(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    }
  }

  const handleYear = (y: string) => {
    setYear(y)
    emit(y, month, day)
  }
  const handleMonth = (m: string) => {
    setMonth(m)
    emit(year, m, day)
  }
  const handleDay = (d: string) => {
    setDay(d)
    emit(year, month, d)
  }

  return (
    <div className="flex gap-1.5">
      <select className={SELECT} value={year} onChange={(e) => handleYear(e.target.value)}>
        <option value="">년도</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <select className={SELECT} value={month} onChange={(e) => handleMonth(e.target.value)}>
        <option value="">월</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}월
          </option>
        ))}
      </select>
      <select className={SELECT} value={day} onChange={(e) => handleDay(e.target.value)}>
        <option value="">일</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}일
          </option>
        ))}
      </select>
    </div>
  )
}
