import { useCallback, useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useData } from './hooks/useData'
import { useFriends } from './hooks/useFriends'
import {
  upsertUserProfile,
  getUserProfile,
  updateUserPhoto,
  updateUserName,
  authErrorMessage,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  sendVerificationEmail,
} from './firebase'
import type { Post } from './types'
import { AppUIProvider, useAppUI } from './contexts/AppUIContext'
import AppLayout from './components/layout/AppLayout'
import HomeTab from './components/HomeTab'
import BooksTab from './components/BooksTab'
import CollectionTab from './components/CollectionTab'
import RecordsTab from './components/RecordsTab'
import FriendsTab from './components/FriendsTab'
import MoreTab from './components/MoreTab'
import LoginModal from './components/modals/LoginModal'
import Toast from './components/Toast'
import AddBookModal from './components/modals/AddBookModal'
import ManualBookModal from './components/modals/ManualBookModal'
import BookDetailModal from './components/modals/BookDetailModal'
import AddQuoteModal from './components/modals/AddQuoteModal'
import AddWordModal from './components/modals/AddWordModal'
import PublishPostModal from './components/modals/PublishPostModal'
import AddFriendModal from './components/modals/AddFriendModal'
import WelcomeModal from './components/modals/WelcomeModal'

const queryClient = new QueryClient()
// 이 브라우저에서 기능 소개를 한 번 본 뒤 남겨두는 표시.
const WELCOME_SEEN_KEY = 'reading-notes-welcome-seen-v1'
// 로그인 권유 모달을 마지막으로 띄웠을 때의 기록 개수. 없으면 아직 한 번도 안 띄운 것.
const PROMOTE_SHOWN_AT_KEY = 'reading-notes-promote-shown-at-v1'
// 예전 버전에서 쓰던 표시("띄웠다" 여부만 저장). 마이그레이션 판단에만 읽는다.
const LEGACY_PROMOTE_SHOWN_KEY = 'reading-notes-promote-shown-v1'
// 기록 3개를 넘긴 게스트에게 로그인을 처음 권하고, 그 뒤로는 3개씩 더 쌓일 때마다 다시 권한다
// — 잃을 게 생긴 시점에만 묻되, 한 번 닫았다고 영영 잊히지는 않게.
const PROMOTE_FIRST = 3
const PROMOTE_INTERVAL = 3

// 다음에 로그인을 권할 기록 개수.
function nextPromoteAt(): number {
  const shownAt = localStorage.getItem(PROMOTE_SHOWN_AT_KEY)
  if (shownAt !== null) return Number(shownAt) + PROMOTE_INTERVAL
  // 예전 버전은 개수를 남기지 않았다. 그때 기준이 3개였으므로 3개에서 봤던 것으로 친다.
  if (localStorage.getItem(LEGACY_PROMOTE_SHOWN_KEY)) return PROMOTE_FIRST + PROMOTE_INTERVAL
  return PROMOTE_FIRST
}

// 카카오톡·인스타그램 등 인앱 브라우저는 구글 로그인 팝업을 차단한다. Chrome/Safari로 유도해야 한다.
function isInAppBrowser() {
  const ua = navigator.userAgent
  return /NAVER|KAKAOTALK|Instagram|FBAN|FBAV|Line\/|MicroMessenger|Snapchat/i.test(ua)
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppUIProvider>
          <AppShell />
        </AppUIProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function AppShell() {
  const { user, loading, signIn, signOut, cachedName, refreshUser } = useAuth()
  const {
    state,
    syncStatus,
    addBook,
    updateBook,
    deleteBook,
    addQuote,
    updateQuote,
    deleteQuote,
    addWord,
    deleteWord,
    exportData,
    setGoal,
  } = useData(user)
  const {
    friends,
    incoming,
    outgoing,
    searchUser,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeRequest,
    loadFriendBooks,
    loadFriendFeed,
    publishPost,
    removePost,
  } = useFriends(user)
  const { tab, modal, showToast, openManualBook, openAddQuote, openWelcome, openLogin, closeModal, changeTab } =
    useAppUI()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (loading) return
    if (localStorage.getItem(WELCOME_SEEN_KEY)) return
    openWelcome()
  }, [loading, openWelcome])

  const closeWelcome = useCallback(() => {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
    closeModal()
  }, [closeModal])

  // 게스트의 기록이 기준 개수를 넘기면, 화면이 정리된 뒤 로그인을 권한다.
  // "넘긴 순간"이 아니라 "그 이후 처음 모달이 다 닫혔을 때"를 기다린다 — 저장 완료 토스트에
  // 곧바로 또 모달이 겹치면 그 자체가 지금 고치려는 문제(요구가 들이닥친다)와 같아진다.
  // 띄울 때의 기록 개수를 담아둔다(null이면 띄울 차례가 아님).
  const promotePendingRef = useRef<number | null>(null)
  const prevCountRef = useRef(0)
  const recordCount = state.books.length + state.quotes.length + state.words.length

  useEffect(() => {
    if (loading) return
    const threshold = nextPromoteAt()
    // 권하는 건 게스트일 때만이지만, 기준값은 로그인 중에도 계속 따라간다.
    // 로그아웃 직후에는 user가 null이 된 렌더에 계정 기록이 잠깐 남아 있는데(비우는 건 다음 렌더),
    // 기준값이 게스트 시절 값에 멈춰 있으면 그 찰나를 "게스트가 기록을 채웠다"로 오인한다.
    if (!user && prevCountRef.current < threshold && recordCount >= threshold) promotePendingRef.current = recordCount
    prevCountRef.current = recordCount
  }, [recordCount, user, loading])

  useEffect(() => {
    if (promotePendingRef.current === null || loading) return
    if (user) {
      promotePendingRef.current = null
      return
    }
    if (modal.type !== 'none') return
    const timer = setTimeout(() => {
      localStorage.setItem(PROMOTE_SHOWN_AT_KEY, String(promotePendingRef.current))
      promotePendingRef.current = null
      openLogin('promote')
    }, 900)
    return () => clearTimeout(timer)
  }, [modal.type, user, loading, openLogin])

  // 내 이름·사진. Auth가 준 값이 아니라 users 문서가 기준이다 — 직접 정한 값이 앱을 다시 열 때마다
  // Google 값으로 되돌아가면 안 되기 때문. Auth 값은 문서가 비어 있을 때의 초기값으로만 쓴다.
  const [myPhotoURL, setMyPhotoURL] = useState('')
  const [myName, setMyName] = useState('')

  useEffect(() => {
    if (!user) {
      setMyPhotoURL('')
      setMyName('')
      return
    }
    let cancelled = false
    getUserProfile(user.uid)
      .then((saved) => {
        if (cancelled) return
        const photoURL = saved?.photoURL || user.photoURL || ''
        const displayName = saved?.displayName || user.displayName || ''
        setMyPhotoURL(photoURL)
        setMyName(displayName)
        const next = { email: user.email ?? '', displayName, photoURL }
        const same =
          saved && saved.email === next.email && saved.displayName === displayName && saved.photoURL === photoURL
        if (!same) upsertUserProfile(user.uid, next).catch(() => {})
      })
      .catch(() => {
        if (cancelled) return
        setMyPhotoURL(user.photoURL ?? '')
        setMyName(user.displayName ?? '')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const handleChangePhoto = useCallback(
    async (photoURL: string) => {
      if (!user) return
      await updateUserPhoto(user.uid, photoURL)
      setMyPhotoURL(photoURL)
    },
    [user],
  )

  const handleChangeName = useCallback(
    async (displayName: string) => {
      if (!user) return
      await updateUserName(user.uid, displayName)
      setMyName(displayName)
    },
    [user],
  )

  const handleExport = useCallback(() => {
    exportData()
    showToast('데이터를 내보냈어요', 'success')
  }, [exportData, showToast])
  const handleFinishBook = useCallback(
    (id: string) => {
      updateBook(id, { status: 'done' })
      showToast('완독 처리했어요', 'success')
    },
    [updateBook, showToast],
  )
  // 구글 로그인 시도는 여기 한 곳에만 있다 — 로그인 진입점(더보기·사이드바·친구탭·승격 모달)이
  // 몇 곳이든 전부 이 함수를 부르므로, 인앱 브라우저 차단도 여기서 한 번만 확인하면 된다.
  const handleSignIn = useCallback(async (): Promise<'ok' | 'blocked' | 'error'> => {
    if (isInAppBrowser()) return 'blocked'
    try {
      await signIn()
      // 다른 계정으로 갈아타도 이전 세션이 보던 탭(예: 친구탭)에 그대로 남지 않도록 홈으로 보낸다.
      changeTab('home')
      return 'ok'
    } catch (e) {
      const shown = authErrorMessage(e)
      if (shown) showToast(shown.msg, shown.type)
      return 'error'
    }
  }, [signIn, showToast, changeTab])
  const handleEmailSignUp = useCallback(
    async (name: string, email: string, password: string) => {
      await signUpWithEmail(name, email, password)
      changeTab('home')
    },
    [changeTab],
  )
  const handleEmailSignIn = useCallback(
    async (email: string, password: string) => {
      await signInWithEmail(email, password)
      changeTab('home')
    },
    [changeTab],
  )
  const handleSignOut = useCallback(async () => {
    if (!confirm('로그아웃할까요?\n이 계정의 데이터는 그대로 남아있어요.')) return
    await signOut()
    showToast('로그아웃됐어요', 'success')
  }, [signOut, showToast])

  return (
    <AppLayout
      user={user}
      photoURL={myPhotoURL}
      displayName={myName}
      syncStatus={syncStatus}
      bookCount={state.books.length}
      collectionCount={state.quotes.length + state.words.length}
      incomingCount={incoming.length}
      onExport={handleExport}
    >
      {tab === 'home' && (
        <HomeTab state={state} userName={myName.split(' ')[0] || cachedName} onFinishBook={handleFinishBook} />
      )}
      {tab === 'books' && <BooksTab books={state.books} quotes={state.quotes} />}
      {tab === 'collection' && (
        <CollectionTab
          quotes={state.quotes}
          books={state.books}
          words={state.words}
          onDeleteQuote={(id) => {
            if (!confirm('이 문장을 삭제할까요?')) return
            deleteQuote(id)
            showToast('문장이 삭제됐어요', 'success')
          }}
          onAddWord={(data) => {
            addWord(data)
            showToast('단어가 저장됐어요', 'success')
          }}
          onDeleteWord={(id) => {
            deleteWord(id)
            showToast('단어가 삭제됐어요', 'success')
          }}
        />
      )}
      {tab === 'records' && (
        <RecordsTab books={state.books} quotes={state.quotes} goal={state.readingGoal} onSetGoal={setGoal} />
      )}
      {tab === 'friends' && (
        <FriendsTab
          user={user}
          authLoading={loading}
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
          onAcceptRequest={acceptRequest}
          onRejectRequest={rejectRequest}
          onRemoveFriend={removeRequest}
          onLoadFriendBooks={loadFriendBooks}
          onLoadFriendFeed={loadFriendFeed}
          onDeletePost={removePost}
        />
      )}
      {tab === 'more' && (
        <MoreTab
          user={user}
          photoURL={myPhotoURL}
          displayName={myName}
          onChangeName={handleChangeName}
          onChangePhoto={handleChangePhoto}
          syncStatus={syncStatus}
          incomingCount={incoming.length}
          recordCount={state.books.length + state.quotes.length + state.words.length}
          onExport={handleExport}
          onSignOut={handleSignOut}
          onSignIn={() => openLogin()}
        />
      )}

      <Toast />

      {modal.type === 'addBook' && (
        <AddBookModal
          onClose={closeModal}
          onSelectBook={(p) => openManualBook(p)}
          onManualEntry={() => openManualBook()}
        />
      )}
      {modal.type === 'manualBook' && (
        <ManualBookModal
          prefill={modal.prefill}
          editId={modal.editId}
          books={state.books}
          onClose={closeModal}
          onSave={(data, editId) => {
            if (editId) {
              updateBook(editId, data)
              showToast('책이 수정됐어요', 'success')
            } else {
              addBook(data)
              showToast('책이 추가됐어요', 'success')
            }
            closeModal()
          }}
        />
      )}
      {modal.type === 'bookDetail' && (
        <BookDetailModal
          bookId={modal.bookId}
          books={state.books}
          quotes={state.quotes}
          onClose={closeModal}
          onEdit={(id) => {
            const b = state.books.find((x) => x.id === id)
            if (b) openManualBook(b, id)
          }}
          onDelete={(id) => {
            const b = state.books.find((x) => x.id === id)
            if (!b) return
            const qc = state.quotes.filter((q) => q.bookId === id).length
            if (
              !confirm(
                qc > 0
                  ? `"${b.title}"을(를) 삭제할까요?\n연결된 인용구 ${qc}개도 함께 사라져요.`
                  : `"${b.title}"을(를) 삭제할까요?`,
              )
            )
              return
            deleteBook(id)
            closeModal()
            showToast('책이 삭제됐어요', 'success')
          }}
          onTogglePrivate={(id, next) => {
            updateBook(id, { isPrivate: next || undefined })
            showToast(next ? '친구에게 비공개로 바꿨어요' : '친구에게 공개로 바꿨어요', 'success')
          }}
          onAddQuote={(bookId) => openAddQuote(bookId)}
          onEditQuote={(quoteId) => openAddQuote(undefined, quoteId)}
        />
      )}
      {modal.type === 'addQuote' && (
        <AddQuoteModal
          books={state.books}
          quotes={state.quotes}
          bookId={modal.bookId}
          editId={modal.editId}
          onClose={closeModal}
          onSave={(data, editId) => {
            if (editId) {
              updateQuote(editId, data)
              showToast('문장이 수정됐어요', 'success')
            } else {
              addQuote(data)
              showToast('문장이 추가됐어요', 'success')
            }
            closeModal()
          }}
          onDelete={(id) => {
            deleteQuote(id)
            closeModal()
            showToast('문장이 삭제됐어요', 'success')
          }}
        />
      )}
      {modal.type === 'addWord' && (
        <AddWordModal
          words={state.words}
          onClose={closeModal}
          onAddWord={(data) => {
            addWord(data)
            showToast('단어가 저장됐어요', 'success')
          }}
        />
      )}
      {modal.type === 'publishPost' && (
        <PublishPostModal
          photoURL={myPhotoURL}
          displayName={myName}
          books={state.books}
          quotes={state.quotes}
          onClose={closeModal}
          onPublish={publishPost}
          onPublished={(post) => queryClient.setQueryData<Post[]>(['friendFeed'], (old) => [post, ...(old ?? [])])}
        />
      )}
      {modal.type === 'addFriend' && (
        <AddFriendModal
          user={user}
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
          onSearch={searchUser}
          onSendRequest={sendRequest}
          onSendVerification={sendVerificationEmail}
          onRefreshUser={refreshUser}
          onClose={closeModal}
        />
      )}

      {modal.type === 'login' && (
        <LoginModal
          reason={modal.reason}
          onClose={closeModal}
          onGoogleSignIn={handleSignIn}
          onEmailSignUp={handleEmailSignUp}
          onEmailSignIn={handleEmailSignIn}
          onPasswordReset={sendPasswordReset}
        />
      )}

      {modal.type === 'welcome' && <WelcomeModal onClose={closeWelcome} />}
    </AppLayout>
  )
}
