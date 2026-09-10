import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import type { UserProfile, FriendRequest, BookStatus, FriendShelf, Post } from '../types'
import BookCard from './BookCard'
import PageHeader from './layout/PageHeader'
import { IconSearch, IconBooks, IconFriends } from './layout/icons'
import { useAppUI } from '../contexts/AppUIContext'
import PostCard from './PostCard'

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
  onAcceptRequest: (requestId: string) => void
  onRejectRequest: (requestId: string) => void
  onRemoveFriend: (friendUid: string) => void
  onLoadFriendBooks: (uid: string) => Promise<FriendShelf>
  onLoadFriendFeed: () => Promise<Post[]>
  onDeletePost: (postId: string) => Promise<void>
}

// 리스트 행 안에 들어가는 버튼이라 작은 사이즈(py-1.5)를 쓴다 — QuoteCard와 같은 규격.
// 경쟁하는 버튼이 없는 단일 액션(수락)이라 연한 배경으로 — 진한 accent는 목록 행 안에서 너무 튄다.
const BTN_SM =
  'bg-accentsoft text-accent border-none font-medium px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SM_SECONDARY =
  'bg-surface text-ink border border-border px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'
const BTN_SM_DANGER =
  'bg-transparent text-danger border border-border px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:bg-dangersoft'
// 수락(연한 배경)과 짝을 이루는 거절 버튼 — 톤은 반대(빨강)지만 모양은 같은 연한 채움으로 맞춘다
const BTN_SM_DANGER_SOFT =
  'bg-dangersoft text-danger border-none font-medium px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:opacity-80'
const STATUS_PILL =
  'text-xs sm:text-[13px] text-dim bg-bg border border-border rounded-full px-2.5 py-[3px] whitespace-nowrap flex-shrink-0'

const SECTION_LABEL = 'text-xs sm:text-[13px] text-dim mb-2'
const LIST_CARD = 'bg-surface border border-border rounded-xl'
const LIST_ROW = 'flex items-center gap-3 px-4 py-3 border-b border-surface2 last:border-b-0'

/** 아바타 + 이름 + 이메일. 검색 결과·받은 요청·보낸 요청·친구 목록에서 같은 모양으로 쓴다. */
function Person({ photoURL, displayName, email }: { photoURL?: string; displayName?: string; email?: string }) {
  return (
    <>
      <Avatar url={photoURL} name={displayName || email || '?'} size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">{displayName || '이름 없음'}</div>
        <div className="text-xs sm:text-[13px] text-dim truncate">{email}</div>
      </div>
    </>
  )
}

function Avatar({ url, name, size }: { url?: string; name: string; size: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-[26px] h-[26px]' : 'w-9 h-9'
  if (url)
    return (
      <img className={`${cls} rounded-full object-cover flex-shrink-0`} src={url} referrerPolicy="no-referrer" alt="" />
    )
  return (
    <span
      className={`${cls} rounded-full object-cover flex-shrink-0 flex items-center justify-center bg-accent text-white font-semibold text-sm`}
    >
      {name[0].toUpperCase()}
    </span>
  )
}

type MainView = 'feed' | 'friends'

function seg(view: MainView, active: MainView, onClick: () => void, label: string) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none sm:px-6 py-1.5 rounded-md text-xs sm:text-[13px] border-none cursor-pointer transition-colors duration-150 ${
        active === view ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
      }`}
    >
      {label}
    </button>
  )
}

export default function FriendsTab({
  user,
  authLoading,
  friends,
  incoming,
  outgoing,
  onAcceptRequest,
  onRejectRequest,
  onRemoveFriend,
  onLoadFriendBooks,
  onLoadFriendFeed,
  onDeletePost,
}: Props) {
  const { openPublishPost, openAddFriend, showToast } = useAppUI()
  const queryClient = useQueryClient()
  const [view, setView] = useState<MainView>('friends')

  const feedQuery = useQuery({
    queryKey: ['friendFeed'],
    queryFn: onLoadFriendFeed,
    enabled: view === 'feed' && !!user,
    // 발행·삭제가 캐시를 직접 갱신하므로, 탭을 왔다갔다 할 때마다 다시 불러올 필요는 없다.
    staleTime: 30_000,
  })
  const feedPosts = feedQuery.data ?? []

  const deletePostMutation = useMutation({
    mutationFn: onDeletePost,
    onSuccess: (_data, postId) => {
      // 삭제 성공 응답을 이미 받았으니, 피드를 다시 불러오지 않고 캐시에서 바로 지운다.
      queryClient.setQueryData<Post[]>(['friendFeed'], (old) => old?.filter((p) => p.id !== postId))
      showToast('게시물이 삭제됐어요', 'success')
    },
  })

  // 수락·거절·친구 삭제는 모두 "서버에 쓰고, 성공하면 토스트" 형태가 같다.
  // 성공 여부를 기다려서 띄우므로 실패한 동작에 완료 문구가 뜨지 않는다.
  const friendActionMutation = useMutation({
    mutationFn: ({ run }: { run: () => void; done: string }) => Promise.resolve(run()),
    onSuccess: (_data, { done }) => showToast(done, 'success'),
    onError: () => showToast('처리 중 오류가 발생했어요', 'error'),
  })

  const [friendFilter, setFriendFilter] = useState('')

  const [viewingFriend, setViewingFriend] = useState<UserProfile | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const friendBooksQuery = useMutation({ mutationFn: onLoadFriendBooks })
  const loadingBooks = friendBooksQuery.isPending
  const friendData = friendBooksQuery.data ?? null

  const handleViewFriend = (friend: UserProfile) => {
    setViewingFriend(friend)
    setStatusFilter('all')
    friendBooksQuery.mutate(friend.uid)
  }

  const filteredFriends = friends.filter((f) => {
    const q = friendFilter.trim().toLowerCase()
    if (!q) return true
    return (f.displayName || '').toLowerCase().includes(q) || (f.email || '').toLowerCase().includes(q)
  })

  if (authLoading) return null

  if (!user) {
    return (
      <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
        <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
          <IconFriends size={22} />
        </div>
        <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">로그인이 필요해요</h3>
        <p className="text-xs sm:text-[13px]">친구 기능은 로그인 후 사용할 수 있어요</p>
      </div>
    )
  }

  if (viewingFriend) {
    // 비공개 책은 서버(getFriendShelf)가 이미 걸러서 준다
    const books = friendData?.books ?? []
    const filtered = books.filter((b) => statusFilter === 'all' || b.status === statusFilter)
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <button
              className="bg-transparent border-none text-ink text-[28px] leading-none cursor-pointer px-1 flex items-center"
              onClick={() => {
                setViewingFriend(null)
                friendBooksQuery.reset()
              }}
            >
              ‹
            </button>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Avatar url={viewingFriend.photoURL} name={viewingFriend.displayName || viewingFriend.email} size="sm" />
              <span>{viewingFriend.displayName || viewingFriend.email}의 책장</span>
            </div>
          </div>
          <div className="flex gap-0.5 p-0.5 rounded-[9px] bg-surface2 border border-border sm:self-auto">
            {STATUS_LABELS.map((s) => {
              const count = s.id === 'all' ? books.length : books.filter((b) => b.status === s.id).length
              return (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`flex-1 sm:flex-none sm:px-4 py-1.5 rounded-md text-xs sm:text-[13px] border-none cursor-pointer transition-colors duration-150 ${
                    statusFilter === s.id ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
                  }`}
                >
                  {s.label} <span className="text-dim">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
        {loadingBooks ? (
          <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
            <p>불러오는 중…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
              <IconBooks size={22} />
            </div>
            <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">
              {books.length === 0 ? '아직 책이 없어요' : '해당 상태의 책이 없어요'}
            </h3>
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
      <PageHeader title="친구" meta={view === 'friends' && friends.length > 0 ? `${friends.length}명` : undefined}>
        {view === 'feed' && (
          <button
            onClick={openPublishPost}
            className="text-[13px] sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accenthover"
          >
            + 공유하기
          </button>
        )}
        {view === 'friends' && (
          <button
            onClick={openAddFriend}
            className="text-[13px] sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-accent text-white border-none cursor-pointer hover:bg-accenthover"
          >
            + 친구 추가
          </button>
        )}
      </PageHeader>

      <div className="flex gap-0.5 p-0.5 mb-5 rounded-[9px] bg-surface2 border border-border sm:w-fit">
        {seg('friends', view, () => setView('friends'), '친구')}
        {seg('feed', view, () => setView('feed'), '피드')}
      </div>

      {view === 'feed' &&
        (feedQuery.isPending ? (
          <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
            <p className="text-sm">불러오는 중…</p>
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
            <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
              <IconFriends size={22} />
            </div>
            <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">아직 공유한 게 없어요</h3>
            <p className="text-xs sm:text-[13px]">마음에 남은 문장이나 책을 친구에게 공유해보세요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {feedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isOwn={post.authorUid === user.uid}
                onDelete={() => {
                  if (confirm('이 게시물을 삭제할까요?')) deletePostMutation.mutate(post.id)
                }}
              />
            ))}
          </div>
        ))}

      {view === 'friends' && (
        <div className="flex flex-col gap-6">
          {/* 받은 요청 */}
          {incoming.length > 0 && (
            <div>
              <div className={SECTION_LABEL}>받은 친구 요청 {incoming.length}</div>
              <div className={LIST_CARD}>
                {incoming.map((req) => (
                  <div key={req.id} className={LIST_ROW}>
                    <Person
                      photoURL={req.profile?.photoURL}
                      displayName={req.profile?.displayName}
                      email={req.profile?.email}
                    />
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        className={BTN_SM}
                        onClick={() =>
                          friendActionMutation.mutate({
                            run: () => onAcceptRequest(req.id),
                            done: '친구 요청을 수락했어요',
                          })
                        }
                      >
                        수락
                      </button>
                      <button
                        className={BTN_SM_DANGER_SOFT}
                        onClick={() =>
                          friendActionMutation.mutate({
                            run: () => onRejectRequest(req.id),
                            done: '친구 요청을 거절했어요',
                          })
                        }
                      >
                        거절
                      </button>
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
                    <Person
                      photoURL={req.profile?.photoURL}
                      displayName={req.profile?.displayName}
                      email={req.profile?.email}
                    />
                    <span className={STATUS_PILL}>대기중</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 친구 목록 */}
          <div>
            {friends.length === 0 ? (
              <div className="text-center py-[60px] px-5 text-dim bg-surface border border-dashed border-border rounded-[10px]">
                <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-surface2 flex items-center justify-center text-dim">
                  <IconFriends size={22} />
                </div>
                <h3 className="font-sans text-ink mb-1.5 text-sm sm:text-[15px]">아직 친구가 없어요</h3>
                <p className="text-xs sm:text-[13px]">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-accentsoft text-accent">
                    + 친구 추가
                  </span>{' '}
                  버튼으로 친구에게 요청을 보내보세요
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 mb-2.5 rounded-lg bg-surface border border-border focus-within:border-accent">
                  <span className="text-dim flex-shrink-0">
                    <IconSearch />
                  </span>
                  <input
                    type="text"
                    placeholder="이름 또는 이메일로 찾기…"
                    value={friendFilter}
                    onChange={(e) => setFriendFilter(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent border-none text-ink py-[9px] text-sm sm:text-[15px] font-sans placeholder:text-dim focus:outline-none"
                  />
                </div>
                {filteredFriends.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-bg px-5 py-8 text-center text-sm text-dim">
                    일치하는 친구가 없어요
                  </div>
                ) : (
                  <div className={LIST_CARD}>
                    {filteredFriends.map((f) => (
                      <div key={f.uid} className={LIST_ROW}>
                        <Person photoURL={f.photoURL} displayName={f.displayName} email={f.email} />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button className={BTN_SM_SECONDARY} onClick={() => handleViewFriend(f)}>
                            책장 보기
                          </button>
                          <button
                            className={BTN_SM_DANGER}
                            onClick={() => {
                              if (confirm(`${f.displayName || f.email}님을 친구 목록에서 삭제할까요?`))
                                friendActionMutation.mutate({
                                  run: () => onRemoveFriend(f.uid),
                                  done: '친구를 삭제했어요',
                                })
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
