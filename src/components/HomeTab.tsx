import { useState } from 'react'
import type { Book, Quote, AppState } from '../types'
import { useAppUI } from '../contexts/AppUIContext'
import {
  goalPace,
  readingSince,
  readDaysCount,
  recordedDaysThisWeek,
  recentActivity,
  relativeDay,
} from '../lib/insights'
import { IconCollection, IconRecords, IconRefresh, IconChevronRight } from './layout/icons'
import { isStorageAtRiskBrowser } from '../lib/browser'
import HighlightedText from './HighlightedText'
import HomeFab from './HomeFab'
import Stars from './Stars'

/** Safari·아이폰이 미접속 데이터를 지우기 시작하는 기준. App.tsx의 값과 같은 의미다. */
const GUEST_WARN_DAYS = 7

interface Props {
  state: AppState
  userName?: string
  onFinishBook: (id: string) => void
  /** 로그인하지 않은 상태면 true. 이때만 저장 위험 배너를 띄운다. */
  isGuest: boolean
  /** 게스트로 기록을 남기기 시작한 뒤 지난 날수. 7일을 넘기면 문구를 강하게 바꾼다. */
  guestDays: number
  onSignIn: () => void
}

/**
 * 인사말은 브라우저 세션마다 하나 랜덤으로 뽑혀 고정된다.
 * 같은 세션에서는 새로고침(강력 새로고침 포함)해도 안 바뀌고,
 * 탭/브라우저를 완전히 닫았다 다시 열면(sessionStorage가 비므로) 새로 뽑힌다.
 * 의문문은 이름이 앞("채채님, ~?"), 평서문은 이름이 뒤("~네요, 채채님 🙂")로 붙는다.
 */
const GREETINGS: { text: string; nameFirst: boolean; emoji?: string }[] = [
  { text: '오늘도 읽으셨나요?', nameFirst: true, emoji: '📖' },
  { text: '오늘의 문장 만나셨나요?', nameFirst: true, emoji: '✨' },
  { text: '몇 장 읽으셨어요?', nameFirst: true, emoji: '📄' },
  { text: '무슨 책 읽어요?', nameFirst: true, emoji: '🧐' },
  { text: '밑줄 찾으셨나요?', nameFirst: true, emoji: '🖍️' },
  { text: '오늘도 책과 함께네요', nameFirst: false, emoji: '📚' },
  { text: '한 문장이면 충분해요', nameFirst: false, emoji: '🌿' },
  { text: '오늘의 문장을 남겨보세요', nameFirst: false, emoji: '🔖' },
]

const GREETING_SESSION_KEY = 'reading-notes-greeting'
const GREETING_STALE_MS = 60 * 60 * 1000 // 뽑은 지 1시간 넘으면 다시 뽑는다

function getGreetingIndex() {
  const raw = sessionStorage.getItem(GREETING_SESSION_KEY)
  if (raw !== null) {
    try {
      const { idx, pickedAt } = JSON.parse(raw)
      const fresh = Date.now() - pickedAt < GREETING_STALE_MS
      if (fresh && Number.isInteger(idx) && idx >= 0 && idx < GREETINGS.length) return idx
    } catch {
      // 저장된 형식이 깨져있으면 새로 뽑는다
    }
  }
  const idx = Math.floor(Math.random() * GREETINGS.length)
  sessionStorage.setItem(GREETING_SESSION_KEY, JSON.stringify({ idx, pickedAt: Date.now() }))
  return idx
}

function pickGreeting(name: string | undefined) {
  const g = GREETINGS[getGreetingIndex()]
  const text = !name ? g.text : g.nameFirst ? `${name}님, ${g.text}` : `${g.text}, ${name}님`
  return { text, emoji: g.emoji }
}

const CARD = 'bg-surface border border-border rounded-xl'
const LABEL = 'font-mono text-[10px] sm:text-[12px] tracking-[0.09em] text-dim'

function Cover({ book, className = '' }: { book: Book; className?: string }) {
  const [err, setErr] = useState(false)
  if (book.cover && !err) {
    return (
      <img
        loading="lazy"
        src={book.cover}
        alt=""
        onError={() => setErr(true)}
        className={`object-cover rounded-md border border-border ${className}`}
      />
    )
  }
  return (
    <div className={`rounded-md bg-surface2 border border-border flex items-center justify-center p-2.5 ${className}`}>
      <span className="text-xs sm:text-[13px] font-medium leading-snug text-center text-ink">{book.title}</span>
    </div>
  )
}

export default function HomeTab({ state, userName, onFinishBook, isGuest, guestDays, onSignIn }: Props) {
  const { openBookDetail, openAddQuote, changeTab } = useAppUI()
  const { books, quotes, words, readingGoal } = state

  const now = new Date()
  const thisYear = now.getFullYear()
  const doneThisYear = books.filter((b) => b.finishedAt?.startsWith(String(thisYear))).length
  const doneThisMonth = books.filter((b) =>
    b.finishedAt?.startsWith(`${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}`),
  ).length
  const pct = readingGoal ? Math.min(100, Math.round((doneThisYear / readingGoal) * 100)) : 0
  const pace = goalPace(doneThisYear, readingGoal, now)
  const reading = books
    .filter((b) => b.status === 'reading')
    .sort((a, b) => readingSince(b).localeCompare(readingSince(a)))
  const activity = recentActivity({ books, quotes, words }, 5)

  const greeting = pickGreeting(userName)

  const recordCount = books.length + quotes.length + words.length
  // 더보기 탭에만 있던 안내를 홈으로 끌어올린다 — 사이드바 배너는 900px 이상에서만 보여서,
  // 모바일 게스트는 더보기에 직접 들어가지 않는 한 위험을 한 번도 못 봤다.
  const showGuestWarning = isGuest && recordCount > 0
  const guestUrgent = guestDays >= GUEST_WARN_DAYS
  // Safari·아이폰은 7일 미접속이면 브라우저가 실제로 지운다. 그때만 "사라져요"라고 단정하고,
  // 나머지 브라우저에는 "사라질 수 있어요"로 둔다 — 크롬에서 단정하면 거짓이 된다.
  const storageAtRisk = isStorageAtRiskBrowser()
  const guestTitle = !guestUrgent
    ? '기록이 이 브라우저에만 저장돼 있어요'
    : storageAtRisk
      ? '로그인하지 않으면 기록이 사라져요'
      : '로그인하지 않으면 기록이 사라질 수 있어요'
  const guestBody = !guestUrgent
    ? storageAtRisk
      ? `기록 ${recordCount}개. 7일 넘게 안 들어오면 사라져요. 로그인하면 안전하게 보관돼요`
      : `기록 ${recordCount}개. 7일 안에 로그인하면 안전하게 보관돼요`
    : storageAtRisk
      ? `저장한 지 ${guestDays}일째예요. 이 브라우저는 7일 넘게 접속하지 않으면 기록을 지워요`
      : `저장한 지 ${guestDays}일째예요. 지금 로그인하면 안전하게 보관되고, 다른 기기에서도 볼 수 있어요`

  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * Math.max(quotes.length, 1)))
  const todayQuote: Quote | undefined = quotes.length ? quotes[quoteIdx % quotes.length] : undefined
  const quoteBook = todayQuote ? books.find((b) => b.id === todayQuote.bookId) : undefined

  const paceText =
    pace.state === 'onTrack'
      ? `${pace.diff >= 0 ? `계획보다 ${pace.diff}권 앞서 있어요` : `계획보다 ${-pace.diff}권 뒤처져 있어요`} · 이 속도면 ${pace.finishMonth}월 달성`
      : pace.state === 'behind'
        ? `지금 속도로는 올해 안엔 빠듯해요 · 남은 ${pace.monthsLeft}개월에 ${pace.remaining}권`
        : pace.state === 'insufficient'
          ? `${pace.remaining}권 남았어요`
          : ''

  return (
    <div className="flex flex-col gap-4 pb-[55px] sm:pb-0">
      <div className="flex gap-2 items-end mb-1">
        <h1 className="text-[19px] sm:text-[22px] font-semibold tracking-[-0.01em]">
          <span className="bg-[linear-gradient(transparent_58%,var(--highlight)_58%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
            {greeting.text}
          </span>
          {greeting.emoji && <span className="ml-1">{greeting.emoji}</span>}
        </h1>
        <div className="font-mono text-xs sm:text-[13px] text-dim">
          {thisYear}.{String(now.getMonth() + 1).padStart(2, '0')}.{String(now.getDate()).padStart(2, '0')}
        </div>
      </div>

      {/* 7일이 지나도 데이터를 지우지는 않는다. 크롬은 브라우저가 안 지우는데 우리가 지울 이유가 없고,
          늦게 돌아온 사람에게 빈 화면을 보여주면 로그인이 아니라 이탈로 이어진다.
          대신 며칠째인지 세서 지났을 때 문구를 올린다. 모양은 더보기의 이메일 인증 배너와 같게. */}
      {showGuestWarning && (
        <button
          type="button"
          onClick={onSignIn}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-dangersoft text-left border-none cursor-pointer w-full"
        >
          <span className="flex-1 flex flex-col gap-1 min-w-0">
            <span className="text-[13px] sm:text-sm font-semibold text-ink">{guestTitle}</span>
            <span className="text-xs sm:text-[13px] text-dim leading-relaxed">{guestBody}</span>
          </span>
          <span className="text-dim flex-shrink-0">
            <IconChevronRight />
          </span>
        </button>
      )}

      {/* 목표 + 보조 지표 */}
      <div className={`${CARD} px-5 py-5 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8`}>
        <div className="flex flex-col gap-2 sm:min-w-[290px]">
          <div className={LABEL}>{thisYear} READING GOAL</div>
          {readingGoal ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[30px] sm:text-[38px] font-semibold leading-none tracking-[-0.02em]">
                  {doneThisYear}
                </span>
                <span className="text-[15px] text-dim">/ {readingGoal}권</span>
                <span className="flex-1" />
                <span className="font-mono text-[13px] font-bold text-accent">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {paceText && <div className="text-xs sm:text-[13px] text-dim">{paceText}</div>}
            </>
          ) : (
            <div className="flex flex-col gap-1 py-2">
              <span className="text-xs sm:text-[15px] text-ink">올해 목표를 아직 안 정했어요</span>
              <span className="text-xs sm:text-[13px] text-dim leading-relaxed">
                <span className="text-ink">기록</span> 탭에서 목표를 설정해보세요
              </span>
            </div>
          )}
        </div>

        <div className="hidden sm:block w-px self-stretch bg-border" />

        <div className="grid grid-cols-3 gap-4 flex-1 pt-4 sm:pt-0 border-t sm:border-t-0 border-border">
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <span className="text-[22px] sm:text-[25px] font-semibold leading-none">{doneThisMonth}</span>
            <span className="font-mono text-[10px] text-dim">이번 달 완독</span>
          </div>
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <span className="text-[22px] sm:text-[25px] font-semibold leading-none">
              {recordedDaysThisWeek({ books, quotes, words })}
              <span className="text-dim">/7</span>
            </span>
            <span className="font-mono text-[10px] text-dim">이번 주 기록한 날</span>
          </div>
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <span className="text-[22px] sm:text-[25px] font-semibold leading-none">{quotes.length}</span>
            <span className="font-mono text-[10px] text-dim">모은 문장</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 지금 읽는 중 */}
        <div className={`${CARD} px-5 py-4 flex flex-col gap-3.5`}>
          <div className={LABEL}>NOW READING</div>
          {reading.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8 rounded-[10px] border border-dashed border-border bg-bg">
              <span className="text-xs sm:text-[13px] text-dim">현재 읽고있는 책이 없습니다</span>
              <button
                onClick={() => changeTab('books')}
                className="text-xs sm:text-[13px] font-medium px-2.5 py-1.5 rounded-lg bg-accentfill text-white border-none cursor-pointer hover:bg-accentfillhover"
              >
                서재에서 고르기
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              {reading.slice(0, 2).map((book) => (
                <div
                  key={book.id}
                  className="flex gap-4 py-4 border-t border-border first:pt-0 first:border-t-0 last:pb-0"
                >
                  <button
                    onClick={() => openBookDetail(book.id)}
                    className="bg-transparent border-none p-0 cursor-pointer flex-shrink-0"
                  >
                    <Cover book={book} className="w-20 h-[120px]" />
                  </button>
                  <div className="flex-1 min-w-0 h-[120px] flex flex-col">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => openBookDetail(book.id)}
                          className="block w-full text-left bg-transparent border-none p-0 cursor-pointer text-[17px] font-medium leading-snug tracking-[-0.01em] text-ink truncate"
                        >
                          {book.title}
                        </button>
                        <div className="mt-0.5 text-xs sm:text-[13px] text-dim truncate">
                          {book.author || '저자 미상'}
                        </div>
                      </div>
                      <span className="mt-1 font-mono text-xs sm:text-[13px] text-dim whitespace-nowrap flex-shrink-0">
                        {readDaysCount(book)}일째 · 문장 {quotes.filter((q) => q.bookId === book.id).length}개
                      </span>
                    </div>
                    <div className="flex-1" />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openAddQuote(book.id)}
                        className="text-[13px] sm:text-sm font-medium px-3 py-1.5 rounded-lg bg-accentfill text-white border-none cursor-pointer hover:bg-accentfillhover"
                      >
                        문장 저장
                      </button>
                      <button
                        onClick={() => onFinishBook(book.id)}
                        className="text-[13px] sm:text-sm px-3 py-1.5 rounded-lg bg-surface text-ink border border-border cursor-pointer hover:bg-surface2"
                      >
                        완독 처리
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오늘의 문장. 문장이 2개 이상이면 카드 전체를 눌러도 다른 문장으로(랜덤) 넘어간다 —
            새로고침 아이콘은 좁은 타깃이라 카드 자체를 누르는 게 더 자연스럽다. */}
        <div
          className={`${CARD} px-5 py-4 flex flex-col gap-3 ${
            todayQuote && quotes.length > 1 ? 'cursor-pointer transition-colors duration-150 hover:border-accent' : ''
          }`}
          onClick={() => {
            if (quotes.length <= 1) return
            setQuoteIdx((i) => {
              const current = ((i % quotes.length) + quotes.length) % quotes.length
              const next = Math.floor(Math.random() * (quotes.length - 1))
              return next >= current ? next + 1 : next
            })
          }}
        >
          <div className="flex items-center justify-between">
            <div className={LABEL}>TODAY&rsquo;S QUOTE</div>
            {quotes.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setQuoteIdx((i) => i + 1)
                }}
                aria-label="다른 문장 보기"
                title="다른 문장 보기"
                className="text-dim bg-transparent border-none cursor-pointer p-0 hover:text-ink"
              >
                <IconRefresh size={15} />
              </button>
            )}
          </div>
          {todayQuote ? (
            <>
              <div className="flex-1 flex items-center py-2">
                <div className="font-serif text-sm sm:text-[15px] leading-[1.85] text-ink">
                  &ldquo;
                  <HighlightedText text={todayQuote.text} highlights={todayQuote.highlights} />
                  &rdquo;
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (quoteBook) openBookDetail(quoteBook.id)
                }}
                className="self-start text-left bg-transparent border-none p-0 text-xs sm:text-[13px] text-dim cursor-pointer hover:text-ink"
              >
                {quoteBook?.title ?? '출처 미상'}
                {todayQuote.page ? ` · p.${todayQuote.page}` : ''}
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-2">
              <span className="text-xs sm:text-[15px] text-ink">아직 모은 문장이 없어요</span>
              {/* 플로팅 + 버튼은 모바일에만 있다(HomeFab) — PC에서는 모음 탭 헤더의 버튼을 안내한다 */}
              <span className="sm:hidden inline-flex items-center gap-1 text-xs text-dim leading-relaxed">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--fab-soft)] text-accent text-[11px] leading-none">
                  +
                </span>
                버튼을 눌러 마음에 남은 문장을 저장해보세요
              </span>
              <span className="hidden sm:inline text-[13px] text-dim leading-relaxed">
                <span className="text-ink">모음</span> 탭에서 마음에 남은 문장을 저장해보세요
              </span>
            </div>
          )}
        </div>

        {/* 최근 활동 */}
        <div className={`${CARD} sm:col-span-2 px-5 py-4 flex flex-col gap-2`}>
          <div className={LABEL}>RECENT ACTIVITY</div>
          {activity.length === 0 ? (
            <div className="py-3 text-sm text-dim">아직 기록이 없어요</div>
          ) : (
            <div className="flex flex-col">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-surface2 last:border-b-0">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${a.kind === 'finished' ? 'bg-accentsoft text-accent' : 'bg-surface2 text-dim'}`}
                  >
                    {a.kind === 'finished' ? (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m4 12 5 5L20 6" />
                      </svg>
                    ) : a.kind === 'word' ? (
                      <IconRecords size={15} />
                    ) : (
                      <IconCollection size={15} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{a.title}</div>
                    {a.sub && (
                      <div className="text-xs sm:text-[13px] text-dim truncate">
                        {a.kind === 'finished' ? `완독 · ${a.sub}` : a.sub}
                      </div>
                    )}
                  </div>
                  {a.kind === 'finished' && a.rating ? (
                    <span className="text-dim flex-shrink-0">
                      <Stars rating={a.rating} size={11} />
                    </span>
                  ) : null}
                  <span className="font-mono text-xs sm:text-[13px] text-dim text-right whitespace-nowrap flex-shrink-0">
                    {relativeDay(a.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <HomeFab />
    </div>
  )
}
