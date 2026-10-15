import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from 'firebase/auth'
import type { UserProfile, FriendRequest, BookStatus, FriendShelf, Post, Recommendation } from '../types'
import BookCard from './BookCard'
import PageHeader from './layout/PageHeader'
import { IconSearch, IconBooks, IconFriends } from './layout/icons'
import { useAppUI } from '../contexts/AppUIContext'
import PostCard from './PostCard'
import { relativeDay } from '../lib/insights'
import PostLikesModal, { type Liker } from './modals/PostLikesModal'
import { toggleLike, getPostLikes } from '../firebase'

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
  onLoadRecommendations: () => Promise<Recommendation[]>
  onRespondRecommendation: (id: string, accept: boolean) => Promise<void>
  /** 권한 책을 내 서재에 담는다. 이미 같은 제목이 있으면 담지 않고 false. */
  onAddRecommendedBook: (rec: Recommendation) => boolean
}

// 리스트 행 안에 들어가는 버튼이라 작은 사이즈(py-1.5)를 쓴다 — QuoteCard와 같은 규격.
// 경쟁하는 버튼이 없는 단일 액션(수락)이라 연한 배경으로 — 진한 accent는 목록 행 안에서 너무 튄다.
const BTN_SM =
  'bg-accentsoft text-accent border-none font-medium px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SM_SECONDARY =
  'bg-surface text-ink border border-border px-2.5 py-1 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-surface2'
const BTN_SM_DANGER =
  'bg-transparent text-danger border border-border px-2.5 py-1 rounded-lg text-xs sm:text-[13px] cursor-pointer transition-all duration-150 font-sans hover:bg-dangersoft'
// 수락(연한 배경)과 짝을 이루는 거절 버튼 — 톤은 반대(빨강)지만 모양은 같은 연한 채움으로 맞춘다
const BTN_SM_DANGER_SOFT =
  'bg-dangersoft text-danger border-none font-medium px-3 py-1.5 rounded-lg text-[13px] sm:text-sm cursor-pointer transition-all duration-150 font-sans hover:opacity-80'
const STATUS_PILL =
  'text-xs sm:text-[13px] text-dim bg-bg border border-border rounded-full px-2.5 py-[3px] whitespace-nowrap flex-shrink-0'

const SECTION_LABEL = 'text-xs sm:text-[13px] text-dim mb-2'
const LIST_CARD = 'bg-surface border border-border rounded-xl'
const LIST_ROW = 'flex items-center gap-3 px-4 py-4 border-b border-surface2 last:border-b-0'

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
      <img
        loading="lazy"
        className={`${cls} rounded-full object-cover flex-shrink-0`}
        src={url}
        referrerPolicy="no-referrer"
        alt=""
      />
    )
  return (
    <span
      className={`${cls} rounded-full object-cover flex-shrink-0 flex items-center justify-center bg-accentfill text-white font-semibold text-sm`}
    >
      {name[0].toUpperCase()}
    </span>
  )
}

/** 친구 책장 로딩 중 자리표시. BookCard와 골격이 같아서 데이터가 도착해도 레이아웃이 밀리지 않는다. */
function BookCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-[10px] overflow-hidden flex flex-row sm:flex-col animate-pulse motion-reduce:animate-none">
      <div className="w-[90px] sm:w-full flex-shrink-0 sm:flex-shrink aspect-[2/3] bg-surface2" />
      <div className="flex-1 sm:flex-none px-3.5 py-3 sm:pt-3 sm:pb-4 flex flex-col justify-start">
        <div className="h-3 w-16 rounded bg-surface2 mb-2 sm:mb-[15px]" />
        <div className="h-4 w-4/5 rounded bg-surface2 mb-2" />
        <div className="h-3 w-1/2 rounded bg-surface2" />
      </div>
    </div>
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
  onLoadRecommendations,
  onRespondRecommendation,
  onAddRecommendedBook,
}: Props) {
  const { openPublishPost, openAddFriend, openLogin, showToast } = useAppUI()
  const queryClient = useQueryClient()
  const [view, setView] = useState<MainView>('friends')

  // 받은 추천. 친구 요청과 달리 실시간 구독이 아니라 — 권유는 콜러블로만 읽는다.
  // 알림함(실시간)이 "권해왔다"를 알려주고, 목록은 친구 탭을 열 때 받아온다.
  const recommendationsQuery = useQuery({
    queryKey: ['recommendations'],
    queryFn: onLoadRecommendations,
    enabled: !!user,
    staleTime: 30_000,
  })
  const recommendations = recommendationsQuery.data ?? []

  const [recBusy, setRecBusy] = useState<string | null>(null)
  const respondToRec = async (rec: Recommendation, accept: boolean) => {
    if (recBusy) return
    setRecBusy(rec.id)
    try {
      // 담는 건 이쪽이다 — 서버가 내 서재에 직접 쓰면 로컬 데이터에 덮어써져 사라진다.
      // 이미 가진 책이면 담지 않지만 권유는 처리된 것으로 본다(책이 서재에 있는 건 같다).
      const added = accept ? onAddRecommendedBook(rec) : false
      await onRespondRecommendation(rec.id, accept)
      queryClient.setQueryData<Recommendation[]>(['recommendations'], (old) => old?.filter((r) => r.id !== rec.id))
      if (!accept) showToast('추천을 지웠어요', 'success')
      else showToast(added ? '읽고싶음에 담았어요' : '이미 서재에 있어요', 'success')
    } catch {
      showToast('처리하지 못했어요. 다시 시도해주세요', 'error')
    } finally {
      setRecBusy(null)
    }
  }

  const feedQuery = useQuery({
    queryKey: ['friendFeed'],
    queryFn: onLoadFriendFeed,
    enabled: view === 'feed' && !!user,
    // 발행·삭제가 캐시를 직접 갱신하므로, 탭을 왔다갔다 할 때마다 다시 불러올 필요는 없다.
    staleTime: 30_000,
  })
  const feedPosts = feedQuery.data ?? []

  // 좋아요는 누른 즉시 화면에 반영하고, 서버가 거절하면 되돌린다.
  // 왕복을 기다리면 하트가 한 박자 늦게 켜져 두 번 누르게 된다.
  const [likeBusy, setLikeBusy] = useState<string | null>(null)
  const handleToggleLike = async (postId: string) => {
    if (likeBusy) return
    setLikeBusy(postId)
    const patch = (fn: (p: Post) => Post) =>
      queryClient.setQueryData<Post[]>(['friendFeed'], (old) => old?.map((p) => (p.id === postId ? fn(p) : p)))
    const before = feedPosts.find((p) => p.id === postId)
    patch((p) => ({ ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }))
    try {
      const r = await toggleLike(postId)
      patch((p) => ({ ...p, likedByMe: r.liked, likeCount: r.count }))
    } catch {
      if (before) patch(() => before)
      showToast('좋아요를 저장하지 못했어요', 'error')
    } finally {
      setLikeBusy(null)
    }
  }

  // 수를 눌렀을 때만 불러온다. 피드 응답에는 누가 눌렀는지가 들어 있지 않다.
  const [likesOf, setLikesOf] = useState<string | null>(null)
  const [likers, setLikers] = useState<Liker[] | null>(null)
  const openLikes = async (postId: string) => {
    setLikesOf(postId)
    setLikers(null)
    try {
      setLikers(await getPostLikes(postId))
    } catch {
      setLikesOf(null)
      showToast('목록을 불러오지 못했어요', 'error')
    }
  }

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

  // 같은 친구를 다시 열 때 매번 새로 불러오지 않도록 캐싱한다 (친구 피드와 동일한 패턴).
  const friendBooksQuery = useQuery({
    queryKey: ['friendShelf', viewingFriend?.uid],
    queryFn: () => onLoadFriendBooks(viewingFriend?.uid ?? ''),
    enabled: !!viewingFriend,
    staleTime: 30_000,
  })
  const loadingBooks = friendBooksQuery.isPending
  const friendData = friendBooksQuery.data ?? null

  const handleViewFriend = (friend: UserProfile) => {
    setViewingFriend(friend)
    setStatusFilter('all')
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
        <p className="text-xs sm:text-[13px] mb-4">친구 기능은 로그인 후 사용할 수 있어요</p>
        <button
          onClick={() => openLogin()}
          className="text-[13px] sm:text-sm font-medium px-4 py-2 rounded-lg bg-accentfill text-white border-none cursor-pointer hover:bg-accentfillhover"
        >
          로그인
        </button>
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
              onClick={() => setViewingFriend(null)}
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
                  {s.label} {!loadingBooks && <span className="text-dim">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
        {loadingBooks ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 sm:gap-[18px]">
            {Array.from({ length: 4 }, (_, i) => (
              <BookCardSkeleton key={i} />
            ))}
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
            className="text-[13px] sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-accentfill text-white border-none cursor-pointer hover:bg-accentfillhover"
          >
            + 공유하기
          </button>
        )}
        {view === 'friends' && (
          <button
            onClick={openAddFriend}
            className="text-[13px] sm:text-sm font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-accentfill text-white border-none cursor-pointer hover:bg-accentfillhover"
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
                onOpenAuthor={(() => {
                  // 피드에는 내 친구 글만 오지만, 친구 목록이 아직 안 받아졌을 수 있어 못 찾으면 넘기지 않는다.
                  const author = friends.find((f) => f.uid === post.authorUid)
                  return post.authorUid === user.uid || !author ? undefined : () => handleViewFriend(author)
                })()}
                onToggleLike={() => handleToggleLike(post.id)}
                onOpenLikes={() => openLikes(post.id)}
                likeBusy={likeBusy === post.id}
              />
            ))}
          </div>
        ))}

      {view === 'friends' && (
        <div className="flex flex-col gap-6">
          {/* 받은 추천 — 피드 게시물(PostCard)과 같은 뼈대. 보낸 사람이 위, 메모가 본문, 책이 첨부. */}
          {recommendations.length > 0 && (
            <div>
              <div className={SECTION_LABEL}>받은 추천 {recommendations.length}</div>
              <div className="flex flex-col gap-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-surface border border-border rounded-[10px] px-4 py-3.5 sm:px-[22px] sm:py-5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar url={rec.fromPhotoURL} name={rec.fromDisplayName || '?'} size="md" />
                        <span className="text-sm text-ink">
                          <span className="font-semibold">{rec.fromDisplayName || '친구'}</span>님이 책을 권했어요
                        </span>
                      </div>
                      <span className="font-mono text-xs sm:text-[13px] text-dim flex-shrink-0">
                        {relativeDay(rec.createdAt)}
                      </span>
                    </div>

                    {rec.message && <div className="text-sm text-ink leading-[1.7] mb-3">{rec.message}</div>}

                    <div className="flex items-center gap-2.5 bg-surface2 rounded-lg p-2.5">
                      <div className="w-11 h-16 rounded bg-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {rec.bookCover ? (
                          <img loading="lazy" src={rec.bookCover} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-dim text-center px-0.5 leading-tight">{rec.bookTitle}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">{rec.bookTitle}</div>
                        <div className="text-xs sm:text-[13px] text-dim truncate mt-0.5">{rec.bookAuthor}</div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 mt-3">
                      <button className={BTN_SM} disabled={recBusy === rec.id} onClick={() => respondToRec(rec, true)}>
                        책장에 담기
                      </button>
                      <button
                        className={BTN_SM_DANGER_SOFT}
                        disabled={recBusy === rec.id}
                        onClick={() => respondToRec(rec, false)}
                      >
                        안 담기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                <div className="flex items-center gap-2 px-3 mb-2.5 rounded-lg bg-surface border border-border focus-within:outline focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-[-1px]">
                  <span className="text-dim flex-shrink-0">
                    <IconSearch />
                  </span>
                  <input
                    type="text"
                    placeholder="이름 또는 이메일로 찾기"
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

      {likesOf && (
        <PostLikesModal
          likers={likers}
          onClose={() => {
            setLikesOf(null)
            setLikers(null)
          }}
        />
      )}
    </div>
  )
}
