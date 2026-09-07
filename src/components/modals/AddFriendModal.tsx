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
const BTN_SM =
  'bg-ink text-bg border-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const STATUS_PILL =
  'text-[11px] text-dim bg-bg border border-border rounded-full px-2.5 py-[3px] whitespace-nowrap flex-shrink-0'

interface Props {
  user: User | null
  friends: UserProfile[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  onSearch: (email: string) => Promise<UserProfile | null>
  onSendRequest: (toUid: string) => void
  onClose: () => void
}

export default function AddFriendModal({ user, friends, incoming, outgoing, onSearch, onSendRequest, onClose }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [searchResult, setSearchResult] = useState<UserProfile | null | 'not-found' | 'self'>()

  const searchMutation = useMutation({
    mutationFn: onSearch,
    onSuccess: (result) => setSearchResult(result ?? 'not-found'),
  })
  const searching = searchMutation.isPending

  const sendRequestMutation = useMutation({
    mutationFn: (toUid: string) => Promise.resolve(onSendRequest(toUid)),
    onSuccess: () => {
      setSearchResult(undefined)
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

  const handleSearch = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (email === user?.email?.toLowerCase()) {
      setSearchResult('self')
      return
    }
    searchMutation.mutate(email)
  }

  return (
    <Modal onClose={onClose}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 className="font-sans text-base font-semibold">친구 추가</h3>
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
              placeholder="친구의 이메일 주소 입력…"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value)
                setSearchResult(undefined)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              autoFocus
              className="flex-1 min-w-0 bg-transparent border-none text-ink py-[9px] text-base font-sans placeholder:text-dim focus:outline-none"
            />
            <span className="w-px self-stretch my-1.5 bg-border flex-shrink-0" />
            <button
              className="flex-shrink-0 bg-transparent border-none px-1 py-[9px] text-xs font-medium text-accent cursor-pointer disabled:text-dim disabled:cursor-not-allowed"
              onClick={handleSearch}
              disabled={searching || !emailInput.trim()}
            >
              {searching ? '검색중…' : '검색'}
            </button>
          </div>

          {searchResult === 'not-found' && (
            <div className="text-[13px] text-dim mt-2.5">해당 이메일로 가입된 계정을 찾을 수 없어요</div>
          )}
          {searchResult === 'self' && <div className="text-[13px] text-dim mt-2.5">내 계정이에요</div>}
          {searchResult && searchResult !== 'not-found' && searchResult !== 'self' && (
            <div className="flex items-center gap-3 px-4 py-3 mt-2.5 border border-border rounded-xl">
              {searchResult.photoURL ? (
                <img
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  src={searchResult.photoURL}
                  referrerPolicy="no-referrer"
                  alt=""
                />
              ) : (
                <span className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-accent text-white font-semibold text-sm">
                  {(searchResult.displayName || searchResult.email || '?')[0].toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{searchResult.displayName || '이름 없음'}</div>
                <div className="text-xs text-dim truncate">{searchResult.email}</div>
              </div>
              {getRequestStatus(searchResult.uid) === 'friend' && <span className={STATUS_PILL}>친구</span>}
              {getRequestStatus(searchResult.uid) === 'sent' && <span className={STATUS_PILL}>요청 보냄</span>}
              {getRequestStatus(searchResult.uid) === 'incoming' && <span className={STATUS_PILL}>받은 요청 있음</span>}
              {getRequestStatus(searchResult.uid) === 'none' && (
                <button
                  className={`${BTN_SM} flex-shrink-0`}
                  onClick={() => sendRequestMutation.mutate(searchResult.uid)}
                  disabled={sending}
                >
                  {sending ? '전송중…' : '친구 추가'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
