import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from './Modal'
import type { BookPrefill } from '../../types'
import { fetchWithAppCheck } from '../../firebase'

interface KakaoItem {
  title: string
  authors: string[]
  thumbnail: string
  datetime: string
  isbn: string
}

// 검색 전에는 내용이 짧아 바텀시트가 화면 아래에 얇게 붙어 보인다.
// 모바일에서만 화면 절반을 최소 높이로 잡아준다 (데스크탑은 가운데 정렬이라 불필요).
const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[560px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px] text-sm sm:text-[15px]'
const FORM_GROUP = 'mb-3.5'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-base font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'

interface Props {
  onClose: () => void
  onSelectBook: (p: BookPrefill) => void
  onManualEntry: () => void
}

async function searchKakaoBooks(q: string): Promise<KakaoItem[]> {
  const res = await fetchWithAppCheck(`/api/kakaoBookSearch?query=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('search failed')
  const data = (await res.json()) as { documents?: KakaoItem[] }
  return data.documents || []
}

export default function AddBookModal({ onClose, onSelectBook, onManualEntry }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInput = (v: string) => {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedQuery(v), 400)
  }

  const {
    data: results = [],
    isFetching: loading,
    isError: error,
    isSuccess,
  } = useQuery({
    queryKey: ['kakaoBooks', debouncedQuery],
    queryFn: () => searchKakaoBooks(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  return (
    <Modal onClose={onClose}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 className="font-sans text-base font-semibold">책 추가</h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          <div className={FORM_GROUP}>
            <input
              type="text"
              placeholder="제목 또는 저자 입력"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              autoComplete="off"
              className={FORM_INPUT}
            />
          </div>
          {loading && (
            <div className="text-center py-5 text-dim text-[13px] after:content-[''] after:inline-block after:w-3.5 after:h-3.5 after:border-2 after:border-border after:border-t-accent after:rounded-full after:ml-2 after:align-middle after:animate-spin">
              검색중
            </div>
          )}
          {error && (
            <div className="text-center py-[30px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
              <p>
                검색 중 오류가 발생했어요.
                <br />
                직접 입력해보세요.
              </p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="max-h-[360px] overflow-y-auto mt-3 border-t border-border pt-3">
              {results.map((item, i) => {
                const title = item.title
                const author = item.authors.join(', ')
                const year = item.datetime ? parseInt(item.datetime.slice(0, 4)) : undefined
                return (
                  <div
                    key={i}
                    className="flex gap-3 p-2.5 rounded-lg cursor-pointer transition-colors duration-150 items-start hover:bg-bg"
                    onClick={() => onSelectBook({ title, author, cover: item.thumbnail, year })}
                  >
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={title}
                        className="w-[50px] h-[70px] object-cover rounded flex-shrink-0 bg-surface2"
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-[50px] h-[70px] bg-surface2 rounded flex items-center justify-center text-xl flex-shrink-0">
                        📕
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm mb-0.5">{title}</div>
                      <div className="text-xs text-dim">{author}</div>
                      {year && <div className="text-[11px] text-dim mt-1">{year}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!loading && !error && isSuccess && results.length === 0 && (
            <div className="text-center py-[30px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
              <p>검색 결과가 없어요</p>
            </div>
          )}
          <div className="text-center my-5 text-dim text-xs">— 또는 —</div>
          <button className={`${BTN_SECONDARY} w-full`} onClick={onManualEntry}>
            직접 입력하기
          </button>
        </div>
      </div>
    </Modal>
  )
}
