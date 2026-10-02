import { useQuery } from '@tanstack/react-query'
import type { Book } from '../types'
import { useAppUI } from '../contexts/AppUIContext'
import { fetchWithAppCheck } from '../firebase'
import { pickAuthors, normalizeTitle, reasonBookFor, RECOMMEND_MIN_DONE } from '../lib/recommend'

interface KakaoItem {
  title: string
  authors: string[]
  thumbnail: string
  datetime: string
}

/** 홈 카드 한 칸에 들어가는 양. 저자 하나가 목록을 다 채우지 않게 저자별로도 제한한다. */
const MAX_SHOWN = 3
const MAX_PER_AUTHOR = 2

interface Suggestion {
  title: string
  author: string
  cover: string
  year: string
  /** 왜 이 책인지 — 사용자가 좋아했던 그 저자의 책 제목. */
  because: string
}

async function searchByAuthor(author: string): Promise<KakaoItem[]> {
  const res = await fetchWithAppCheck(`/api/kakaoBookSearch?query=${encodeURIComponent(author)}&target=person`)
  if (!res.ok) throw new Error('search failed')
  const data = (await res.json()) as { documents?: KakaoItem[] }
  return data.documents || []
}

const CARD = 'bg-surface border border-border rounded-xl'
const LABEL = 'font-mono text-[10px] sm:text-[12px] tracking-[0.09em] text-dim'
const BTN_SM =
  'bg-accentsoft text-accent border-none font-medium px-3 py-1.5 rounded-lg text-[13px] cursor-pointer whitespace-nowrap flex-shrink-0 hover:opacity-80'

export default function TodayRecommendation({ books }: { books: Book[] }) {
  const { openManualBook } = useAppUI()
  const authors = pickAuthors(books)
  const doneCount = books.filter((b) => b.status === 'done').length

  const { data, isLoading } = useQuery({
    queryKey: ['todayRecommendation', authors.join('|')],
    enabled: authors.length > 0,
    // 서재가 그대로면 추천도 그대로다. 탭을 오갈 때마다 다시 부르지 않게 길게 잡는다.
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Suggestion[]> => {
      const results = await Promise.all(
        authors.map(async (a) => ({ author: a, items: await searchByAuthor(a).catch(() => []) })),
      )
      // 이미 서재에 있는 책을 권해봐야 소용없다. 제목을 정규화해 걸러낸다.
      const owned = new Set(books.map((b) => normalizeTitle(b.title)))
      const picked = new Set<string>()
      const out: Suggestion[] = []
      for (const { author, items } of results) {
        const because = reasonBookFor(books, author) ?? ''
        let count = 0
        for (const it of items) {
          const key = normalizeTitle(it.title)
          if (!key || owned.has(key) || picked.has(key)) continue
          if (!it.thumbnail) continue // 표지가 없으면 줄이 휑해 보인다
          picked.add(key)
          out.push({
            title: it.title,
            author: it.authors.join(', ') || author,
            cover: it.thumbnail,
            year: it.datetime?.slice(0, 4) ?? '',
            because,
          })
          if (++count >= MAX_PER_AUTHOR) break
        }
      }
      return out.slice(0, MAX_SHOWN)
    },
  })

  return (
    <div className={`${CARD} px-5 py-4 flex flex-col gap-3`}>
      <div className={LABEL}>YOU MIGHT LIKE</div>

      {authors.length === 0 ? (
        // 표본이 모자랄 때는 조건을 알려준다. 그냥 비워두면 고장난 것으로 읽힌다.
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-2">
          <span className="text-xs sm:text-[15px] text-ink">
            완독한 책이 {RECOMMEND_MIN_DONE}권 모이면 추천해드려요
          </span>
          <span className="text-xs sm:text-[13px] text-dim leading-relaxed">
            지금까지 {doneCount}권 · 별점을 남기면 취향을 더 잘 맞춰요
          </span>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-2 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="w-9 h-[52px] rounded bg-surface2 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 rounded bg-surface2" />
                <div className="h-3 w-2/3 rounded bg-surface2" />
              </div>
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1 py-2">
          <span className="text-xs sm:text-[15px] text-ink">권해드릴 새 책을 못 찾았어요</span>
          <span className="text-xs sm:text-[13px] text-dim leading-relaxed">책을 더 읽고 별점을 남겨보세요</span>
        </div>
      ) : (
        <div className="flex flex-col">
          {data.map((s) => (
            <div
              key={s.title + s.author}
              className="flex items-center gap-3 py-2 border-b border-surface2 last:border-b-0"
            >
              <img
                src={s.cover}
                alt=""
                loading="lazy"
                className="w-9 h-[52px] object-cover rounded border border-border flex-shrink-0 block"
              />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-ink truncate">{s.title}</span>
                <span className="text-xs sm:text-[13px] text-dim truncate">{s.author}</span>
                {s.because && <span className="text-xs text-dim opacity-70 truncate">『{s.because}』 저자</span>}
              </div>
              {/* 친구 추가 모달의 결과 행과 같은 규격 — 경쟁하는 버튼이 없는 단일 액션이라 연한 배경으로 둔다. */}
              <button
                type="button"
                onClick={() => openManualBook({ title: s.title, author: s.author, cover: s.cover, year: s.year })}
                aria-label={`${s.title} 책 추가`}
                className={BTN_SM}
              >
                책 추가
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
