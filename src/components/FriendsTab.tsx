import { useState } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile, FriendRequest, BookStatus, AppState } from '../types'
import BookCard from './BookCard'

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

export default function FriendsTab({ user, authLoading, friends, incoming, outgoing, onSearch, onSendRequest, onAcceptRequest, onRejectRequest, onRemoveFriend, onLoadFriendBooks }: Props) {
  const [emailInput, setEmailInput] = useState('')
  const [searchResult, setSearchResult] = useState<UserProfile | null | 'not-found' | 'self'>()
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)

  const [viewingFriend, setViewingFriend] = useState<UserProfile | null>(null)
  const [friendData, setFriendData] = useState<AppState | null>(null)
  const [loadingBooks, setLoadingBooks] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const handleSearch = async () => {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    if (email === user?.email?.toLowerCase()) { setSearchResult('self'); return }
    setSearching(true)
    const result = await onSearch(email)
    setSearchResult(result ?? 'not-found')
    setSearching(false)
  }

  const handleSendRequest = async (toUid: string) => {
    setSending(true)
    await onSendRequest(toUid)
    setSending(false)
    setSearchResult(undefined)
    setEmailInput('')
  }

  const handleViewFriend = async (friend: UserProfile) => {
    setViewingFriend(friend)
    setStatusFilter('all')
    setLoadingBooks(true)
    const data = await onLoadFriendBooks(friend.uid)
    setFriendData(data)
    setLoadingBooks(false)
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
      <div className="empty-state">
        <div className="icon">👥</div>
        <h3>로그인이 필요해요</h3>
        <p>친구 기능은 로그인 후 사용할 수 있어요</p>
      </div>
    )
  }

  if (viewingFriend) {
    const books = (friendData?.books ?? []).filter((b) => !b.isPrivate)
    const filtered = books.filter((b) => statusFilter === 'all' || b.status === statusFilter)
    return (
      <div>
        <div className="friend-books-header">
          <button className="friend-back-btn" onClick={() => { setViewingFriend(null); setFriendData(null) }}>‹</button>
          <div className="friend-books-title">
            {viewingFriend.photoURL
              ? <img className="friend-avatar-sm" src={viewingFriend.photoURL} referrerPolicy="no-referrer" alt="" />
              : <span className="friend-avatar-sm friend-avatar-initial">{(viewingFriend.displayName || viewingFriend.email)[0].toUpperCase()}</span>
            }
            <span>{viewingFriend.displayName || viewingFriend.email}의 책장</span>
          </div>
        </div>
        <div className="filter-chips" style={{ marginBottom: 16 }}>
          <div className="chips">
            {STATUS_LABELS.map((s) => {
              const count = s.id === 'all' ? books.length : books.filter((b) => b.status === s.id).length
              return (
                <button key={s.id} data-status={s.id} className={`chip${statusFilter === s.id ? ' active' : ''}`} onClick={() => setStatusFilter(s.id)}>
                  {s.label} ({count})
                </button>
              )
            })}
          </div>
        </div>
        {loadingBooks ? (
          <div className="empty-state"><p>불러오는 중…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📚</div>
            <h3>{books.length === 0 ? '아직 책이 없어요' : '해당 상태의 책이 없어요'}</h3>
          </div>
        ) : (
          <div className="books-grid">
            {filtered.map((b) => (
              <BookCard key={b.id} book={b} quoteCount={0} onClick={() => {}} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="friends-tab">
      {/* 검색 */}
      <div className="friend-search">
        <div className="friend-search-row">
          <input
            type="email"
            placeholder="친구의 이메일 주소 입력…"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setSearchResult(undefined) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn" onClick={handleSearch} disabled={searching || !emailInput.trim()}>
            {searching ? '검색중…' : '검색'}
          </button>
        </div>

        {searchResult === 'not-found' && (
          <div className="friend-search-msg">해당 이메일로 가입된 계정을 찾을 수 없어요</div>
        )}
        {searchResult === 'self' && (
          <div className="friend-search-msg">내 계정이에요</div>
        )}
        {searchResult && searchResult !== 'not-found' && searchResult !== 'self' && (
          <div className="friend-result">
            <div className="friend-row-info">
              {searchResult.photoURL
                ? <img className="friend-avatar" src={searchResult.photoURL} referrerPolicy="no-referrer" alt="" />
                : <span className="friend-avatar friend-avatar-initial">{(searchResult.displayName || searchResult.email)[0].toUpperCase()}</span>
              }
              <div>
                <div className="friend-name">{searchResult.displayName || '이름 없음'}</div>
                <div className="friend-email">{searchResult.email}</div>
              </div>
            </div>
            {getRequestStatus(searchResult.uid) === 'friend' && <span className="friend-status-tag">친구</span>}
            {getRequestStatus(searchResult.uid) === 'sent' && <span className="friend-status-tag">요청 보냄</span>}
            {getRequestStatus(searchResult.uid) === 'incoming' && <span className="friend-status-tag">받은 요청 있음</span>}
            {getRequestStatus(searchResult.uid) === 'none' && (
              <button className="btn btn-sm" onClick={() => handleSendRequest(searchResult.uid)} disabled={sending}>
                {sending ? '전송중…' : '친구 추가'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 받은 요청 */}
      {incoming.length > 0 && (
        <div className="friends-section">
          <div className="friends-section-title">받은 친구 요청 ({incoming.length})</div>
          {incoming.map((req) => (
            <div key={req.id} className="friend-row">
              <div className="friend-row-info">
                {req.profile?.photoURL
                  ? <img className="friend-avatar" src={req.profile.photoURL} referrerPolicy="no-referrer" alt="" />
                  : <span className="friend-avatar friend-avatar-initial">{(req.profile?.displayName || req.profile?.email || '?')[0].toUpperCase()}</span>
                }
                <div>
                  <div className="friend-name">{req.profile?.displayName || '이름 없음'}</div>
                  <div className="friend-email">{req.profile?.email}</div>
                </div>
              </div>
              <div className="friend-row-actions">
                <button className="btn btn-sm" onClick={() => onAcceptRequest(req.id)}>수락</button>
                <button className="btn btn-secondary btn-sm" onClick={() => onRejectRequest(req.id)}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 보낸 요청 대기중 */}
      {outgoing.length > 0 && (
        <div className="friends-section">
          <div className="friends-section-title">보낸 요청 대기중 ({outgoing.length})</div>
          {outgoing.map((req) => (
            <div key={req.id} className="friend-row">
              <div className="friend-row-info">
                {req.profile?.photoURL
                  ? <img className="friend-avatar" src={req.profile.photoURL} referrerPolicy="no-referrer" alt="" />
                  : <span className="friend-avatar friend-avatar-initial">{(req.profile?.displayName || req.profile?.email || '?')[0].toUpperCase()}</span>
                }
                <div>
                  <div className="friend-name">{req.profile?.displayName || '이름 없음'}</div>
                  <div className="friend-email">{req.profile?.email}</div>
                </div>
              </div>
              <span className="friend-status-tag">대기중</span>
            </div>
          ))}
        </div>
      )}

      {/* 친구 목록 */}
      <div className="friends-section">
        <div className="friends-section-title">친구 {friends.length > 0 ? `(${friends.length})` : ''}</div>
        {friends.length === 0 ? (
          <div className="friends-empty">아직 친구가 없어요. 이메일로 친구를 찾아보세요!</div>
        ) : (
          friends.map((f) => (
            <div key={f.uid} className="friend-row">
              <div className="friend-row-info">
                {f.photoURL
                  ? <img className="friend-avatar" src={f.photoURL} referrerPolicy="no-referrer" alt="" />
                  : <span className="friend-avatar friend-avatar-initial">{(f.displayName || f.email)[0].toUpperCase()}</span>
                }
                <div>
                  <div className="friend-name">{f.displayName || '이름 없음'}</div>
                  <div className="friend-email">{f.email}</div>
                </div>
              </div>
              <div className="friend-row-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleViewFriend(f)}>책장 보기</button>
                <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`${f.displayName || f.email}님을 친구 목록에서 삭제할까요?`)) onRemoveFriend(f.uid) }}>삭제</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
