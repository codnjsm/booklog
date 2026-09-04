import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import type { UserProfile, FriendRequest, BookStatus, AppState } from '../types'
import BookCard from './BookCard'
import PageHeader from './layout/PageHeader'
import { IconSearch, IconBooks, IconFriends } from './layout/icons'

type StatusFilter = BookStatus | 'all'
const STATUS_LABELS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'wishlist', label: '읽고싶음' },
  { id: 'reading', label: '읽는중' },
  { id: 'done', label: '완독' },
]

interface Props {
  user: User | null
  authLoading: boolean
  friends: UserProfile[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  onSearch: (email: string) => Promise<UserProfile | null>
  onSendRequest: (toUid: string) => void
  onAcceptRequest: (requestId: string) => void
  onRejectRequest: (requestId: string) => void
  onRemoveFriend: (friendUid: string) => void
  onLoadFriendBooks: (uid: string) => Promise<AppState | null>
}

const BTN_SM = "bg-ink text-bg border-none px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
const BTN_SM_SECONDARY = "bg-surface text-ink border border-border px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2"
const STATUS_PILL = "text-[11px] text-dim bg-bg border border-border rounded-full px-2.5 py-[3px] whitespace-nowrap flex-shrink-0"

function chipClass(isActive: boolean) {
  const base = "px-3 py-[9px] border rounded-full text-xs cursor-pointer transition-all duration-150 font-sans"
  return isActive ? `${base} bg-accentsoft border-accent text-accent` : `${base} bg-surface border-border text-dim hover:text-ink`
}

const SECTION_LABEL = "text-xs text-dim mb-2"
const LIST_CARD = "bg-surface border border-border rounded-xl"
const LIST_ROW = "flex items-center gap-3 px-4 py-3 border-b border-surface2 last:border-b-0"

/** 아바타 + 이름 + 이메일. 검색 결과·받은 요청·보낸 요청·친구 목록에서 같은 모양으로 쓴다. */
function Person({ photoURL, displayName, email }: { photoURL?: string; displayName?: string; email?: string }) {
  return (
    <>
      <Avatar url={photoURL} name={displayName || email || '?'} size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">{displayName || '이름 없음'}</div>
        <div className="text-xs text-dim truncate">{email}</div>
      </div>
    </>
  )
}

function Avatar({ url, name, size }: { url?: string; name: string; size: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-[26px] h-[26px]' : 'w-9 h-9'
  if (url) return <img className={`${cls} rounded-full object-cover flex-shrink-0`} src={url} referrerPolicy="no-referrer" alt="" />
  return <span className={`${cls} rounded-full object-cover flex-shrink-0 flex items-center justify-center bg-accent text-white font-semibold text-sm`}>{name[0].toUpperCase()}</span>
}

export default function FriendsTab({ user, authLoading, friends, incoming, outgoing, onSearch, onSendRequest, onAcceptRequest, onRejectRequest, onRemoveFriend, onLoadFriendBooks }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [searchResult, setSearchResult] = useState<UserProfile | null | 'not-found' | 'self'>()

  const [viewingFriend, setViewingFriend] = useState<UserProfile | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const searchMutation = useMutation({
    mutationFn: onSearch,
    onSuccess: (result) => setSearchResult(result ?? 'not-found'),
  })
  const searching = searchMutation.isPending

  const sendRequestMutation = useMutation({
    mutationFn: (toUid: string) => Promise.resolve(onSendRequest(toUid)),
    onSuccess: () => { setSearchResult(undefined); setEmailInput('') },
  })
  const sending = sendRequestMutation.isPending

  const friendBooksQuery = useMutation({ mutationFn: onLoadFriendBooks })
  const loadingBooks = friendBooksQuery.isPending
  const friendData = friendBooksQuery.data ?? null

  const handleSearch = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (email === user?.email?.toLowerCase()) { setSearchResult('self'); return }
    searchMutation.mutate(email)
  }

  const handleViewFriend = (friend: UserProfile) => {
    setViewingFriend(friend)
    setStatusFilter('all')
    friendBooksQuery.mutate(friend.uid)
  }

  const getRequestStatus = (uid: string) => {
    if (friends.some((f) => f.uid === uid)) return 'friend'
    if (outgoing.some((r) => r.toUid === uid)) return 'sent'
    if (incoming.some((r) => r.fromUid === uid)) return 'incoming'
    return 'none'
  }

  if (authLoading) return null

  if (!user) {
    return (
      <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
        <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim"><IconFriends size={22} /></div>
        <h3 className="font-sans text-ink mb-1.5 text-[15px]">로그인이 필요해요</h3>
        <p className="text-sm">친구 기능은 로그인 후 사용할 수 있어요</p>
      </div>
    )
  }

  if (viewingFriend) {
    const books = (friendData?.books ?? []).filter((b) => !b.isPrivate)
    const filtered = books.filter((b) => statusFilter === 'all' || b.status === statusFilter)
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <button className="bg-transparent border-none text-ink text-[28px] leading-none cursor-pointer px-1 flex items-center" onClick={() => { setViewingFriend(null); friendBooksQuery.reset() }}>‹</button>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Avatar url={viewingFriend.photoURL} name={viewingFriend.displayName || viewingFriend.email} size="sm" />
            <span>{viewingFriend.displayName || viewingFriend.email}의 책장</span>
          </div>
        </div>
        <div className="flex justify-between gap-3 items-center w-full mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_LABELS.map((s) => {
              const count = s.id === 'all' ? books.length : books.filter((b) => b.status === s.id).length
              return (
                <button key={s.id} className={chipClass(statusFilter === s.id)} onClick={() => setStatusFilter(s.id)}>
                  {s.label} ({count})
                </button>
              )
            })}
          </div>
        </div>
        {loadingBooks ? (
          <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]"><p>불러오는 중…</p></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim"><IconBooks size={22} /></div>
            <h3 className="font-sans text-ink mb-1.5 text-[15px]">{books.length === 0 ? '아직 책이 없어요' : '해당 상태의 책이 없어요'}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 sm:gap-[18px]">
            {filtered.map((b) => (
              <BookCard key={b.id} book={b} quoteCount={0} onClick={() => {}} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="친구" meta={friends.length > 0 ? `${friends.length}명` : undefined} />
      <div className="flex flex-col gap-6">
      {/* 검색 */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 px-3 rounded-lg bg-surface border border-border focus-within:border-accent">
          <span className="text-dim flex-shrink-0"><IconSearch /></span>
          <input
            type="email"
            placeholder="친구의 이메일 주소 입력…"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setSearchResult(undefined) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
          <div className="text-[13px] text-dim">해당 이메일로 가입된 계정을 찾을 수 없어요</div>
        )}
        {searchResult === 'self' && (
          <div className="text-[13px] text-dim">내 계정이에요</div>
        )}
        {searchResult && searchResult !== 'not-found' && searchResult !== 'self' && (
          <div className={`${LIST_CARD} ${LIST_ROW}`}>
            <Person photoURL={searchResult.photoURL} displayName={searchResult.displayName} email={searchResult.email} />
            {getRequestStatus(searchResult.uid) === 'friend' && <span className={STATUS_PILL}>친구</span>}
            {getRequestStatus(searchResult.uid) === 'sent' && <span className={STATUS_PILL}>요청 보냄</span>}
            {getRequestStatus(searchResult.uid) === 'incoming' && <span className={STATUS_PILL}>받은 요청 있음</span>}
            {getRequestStatus(searchResult.uid) === 'none' && (
              <button className={`${BTN_SM} flex-shrink-0`} onClick={() => sendRequestMutation.mutate(searchResult.uid)} disabled={sending}>
                {sending ? '전송중…' : '친구 추가'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 받은 요청 */}
      {incoming.length > 0 && (
        <div>
          <div className={SECTION_LABEL}>받은 친구 요청 {incoming.length}</div>
          <div className={LIST_CARD}>
            {incoming.map((req) => (
              <div key={req.id} className={LIST_ROW}>
                <Person photoURL={req.profile?.photoURL} displayName={req.profile?.displayName} email={req.profile?.email} />
                <div className="flex gap-1.5 flex-shrink-0">
                  <button className={BTN_SM} onClick={() => onAcceptRequest(req.id)}>수락</button>
                  <button className="bg-transparent text-danger border border-border px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10" onClick={() => onRejectRequest(req.id)}>거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 보낸 요청 대기중 */}
      {outgoing.length > 0 && (
        <div>
          <div className={SECTION_LABEL}>보낸 요청 대기중 {outgoing.length}</div>
          <div className={LIST_CARD}>
            {outgoing.map((req) => (
              <div key={req.id} className={LIST_ROW}>
                <Person photoURL={req.profile?.photoURL} displayName={req.profile?.displayName} email={req.profile?.email} />
                <span className={STATUS_PILL}>대기중</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 친구 목록 */}
      <div>
        <div className={SECTION_LABEL}>친구</div>
        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg px-5 py-8 text-center text-sm text-dim">
            아직 친구가 없어요<br />위에서 이메일로 친구를 찾아보세요
          </div>
        ) : (
          <div className={LIST_CARD}>
            {friends.map((f) => (
              <div key={f.uid} className={LIST_ROW}>
                <Person photoURL={f.photoURL} displayName={f.displayName} email={f.email} />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className={BTN_SM_SECONDARY} onClick={() => handleViewFriend(f)}>책장 보기</button>
                  <button
                    className="bg-transparent text-danger border border-border px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-danger/10"
                    onClick={() => { if (confirm(`${f.displayName || f.email}님을 친구 목록에서 삭제할까요?`)) onRemoveFriend(f.uid) }}
                  >삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
