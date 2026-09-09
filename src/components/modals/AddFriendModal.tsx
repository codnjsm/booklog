import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import type { UserProfile, FriendRequest } from '../../types'
import { IconSearch } from '../layout/icons'
import Modal from './Modal'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full min-h-[min(500px,90%)] sm:max-w-[560px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
// 검색 결과 행 안에 들어가는 버튼이라 작은 사이즈(py-1.5)를 쓴다 — 친구 탭의 수락 버튼과 같은 규격
const BTN_SM =
  'bg-accent text-white border-none font-medium px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:bg-accenthover disabled:opacity-50 disabled:cursor-not-allowed'
const STATUS_PILL =
  'text-xs sm:text-[13px] text-dim bg-bg border border-border rounded-full px-2.5 py-[3px] whitespace-nowrap flex-shrink-0'

/** 서버가 이 글자 수 미만은 거부한다 — 버튼을 미리 막아 헛걸음을 줄인다. */
const MIN_SEARCH_LENGTH = 4

interface Props {
  user: User | null
  friends: UserProfile[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  onSearch: (email: string) => Promise<UserProfile[]>
  onSendRequest: (toUid: string) => void
  onClose: () => void
}

export default function AddFriendModal({ user, friends, incoming, outgoing, onSearch, onSendRequest, onClose }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [results, setResults] = useState<UserProfile[] | 'self'>()

  const searchMutation = useMutation({
    mutationFn: onSearch,
    onSuccess: (found) => setResults(found),
  })
  const searching = searchMutation.isPending

  const sendRequestMutation = useMutation({
    mutationFn: (toUid: string) => Promise.resolve(onSendRequest(toUid)),
    onSuccess: () => {
      setResults(undefined)
      setEmailInput('')
    },
  })
  const sending = sendRequestMutation.isPending

  const getRequestStatus = (uid: string) => {
    if (friends.some((f) => f.uid === uid)) return 'friend'
    if (outgoing.some((r) => r.toUid === uid)) return 'sent'
    if (incoming.some((r) => r.fromUid === uid)) return 'incoming'
    return 'none'
  }

  const query = emailInput.trim().toLowerCase()
  const tooShort = query.length > 0 && query.length < MIN_SEARCH_LENGTH

  const handleSearch = () => {
    if (query.length < MIN_SEARCH_LENGTH) return
    if (query === user?.email?.toLowerCase()) {
      setResults('self')
      return
    }
    searchMutation.mutate(query)
  }

  return (
    <Modal onClose={onClose} labelledBy="add-friend-modal-title">
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id="add-friend-modal-title" className="font-sans text-base font-semibold">
            친구 추가
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          <div className="flex items-center gap-2 px-3 rounded-lg bg-surface2 border border-border focus-within:border-accent">
            <span className="text-dim flex-shrink-0">
              <IconSearch />
            </span>
            <input
              type="email"
              placeholder="친구의 이메일 앞부분 입력…"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                setResults(undefined)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
              className="flex-1 min-w-0 bg-transparent border-none text-ink py-[9px] text-sm sm:text-[15px] font-sans placeholder:text-dim focus:outline-none"
            />
            <span className="w-px self-stretch my-1.5 bg-border flex-shrink-0" />
            <button
              className="flex-shrink-0 bg-transparent border-none px-1 py-[9px] text-[13px] sm:text-sm font-medium text-accent cursor-pointer disabled:text-dim disabled:cursor-not-allowed"
              onClick={handleSearch}
              disabled={searching || query.length < MIN_SEARCH_LENGTH}
            >
              {searching ? '검색중…' : '검색'}
            </button>
          </div>

          {tooShort && (
            <div className="text-xs sm:text-[13px] text-dim mt-2.5">{MIN_SEARCH_LENGTH}자 이상 입력해주세요</div>
          )}

          {results === 'self' && <div className="text-xs sm:text-[13px] text-dim mt-2.5">내 계정이에요</div>}
          {Array.isArray(results) && results.length === 0 && (
            <div className="text-xs sm:text-[13px] text-dim mt-2.5">해당 이메일로 시작하는 계정을 찾을 수 없어요</div>
          )}
          {Array.isArray(results) && results.length > 0 && (
            <div className="mt-2.5 border border-border rounded-xl">
              {results.map((person) => (
                <div
                  key={person.uid}
                  className="flex items-center gap-3 px-4 py-3 border-b border-surface2 last:border-b-0"
                >
                  {person.photoURL ? (
                    <img
                      className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      src={person.photoURL}
                      referrerPolicy="no-referrer"
                      alt=""
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-accent text-white font-semibold text-sm">
                      {(person.displayName || person.email || '?')[0].toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{person.displayName || '이름 없음'}</div>
                    <div className="text-xs sm:text-[13px] text-dim truncate">{person.email}</div>
                  </div>
                  {getRequestStatus(person.uid) === 'friend' && <span className={STATUS_PILL}>친구</span>}
                  {getRequestStatus(person.uid) === 'sent' && <span className={STATUS_PILL}>요청 보냄</span>}
                  {getRequestStatus(person.uid) === 'incoming' && <span className={STATUS_PILL}>받은 요청 있음</span>}
                  {getRequestStatus(person.uid) === 'none' && (
                    <button
                      className={`${BTN_SM} flex-shrink-0`}
                      onClick={() => sendRequestMutation.mutate(person.uid)}
                      disabled={sending}
                    >
                      {sending ? '전송중…' : '친구 추가'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
