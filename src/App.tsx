import { useCallback, useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useData } from './hooks/useData'
import { useFriends } from './hooks/useFriends'
import {
  upsertUserProfile,
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
// 로그인 권유 모달을 이미 한 번 보여줬는지 남겨두는 표시. 한 번 뜨면 다시 안 띄운다.
const PROMOTE_SHOWN_KEY = 'reading-notes-promote-shown-v1'
// 책 3권 또는 문장 3개를 넘긴 게스트에게 로그인을 권한다 — 잃을 게 생긴 시점에만 묻는다.
const PROMOTE_THRESHOLD = 3

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

  // 게스트가 책 3권 또는 문장 3개를 넘기면, 화면이 정리된 뒤 로그인을 한 번 권한다.
  // "넘긴 순간"이 아니라 "그 이후 처음 모달이 다 닫혔을 때"를 기다린다 — 저장 완료 토스트에
  // 곧바로 또 모달이 겹치면 그 자체가 지금 고치려는 문제(요구가 들이닥친다)와 같아진다.
  const promotePendingRef = useRef(false)
  const prevCountsRef = useRef({ books: 0, quotes: 0 })

  useEffect(() => {
    if (loading || user) return
    if (localStorage.getItem(PROMOTE_SHOWN_KEY)) return
    const prev = prevCountsRef.current
    const crossed =
      (prev.books < PROMOTE_THRESHOLD && state.books.length >= PROMOTE_THRESHOLD) ||
      (prev.quotes < PROMOTE_THRESHOLD && state.quotes.length >= PROMOTE_THRESHOLD)
    if (crossed) promotePendingRef.current = true
    prevCountsRef.current = { books: state.books.length, quotes: state.quotes.length }
  }, [state.books.length, state.quotes.length, user, loading])

  useEffect(() => {
    if (!promotePendingRef.current || loading) return
    if (user) {
      promotePendingRef.current = false
      return
    }
    if (modal.type !== 'none') return
    const timer = setTimeout(() => {
      promotePendingRef.current = false
      localStorage.setItem(PROMOTE_SHOWN_KEY, '1')
      openLogin('promote')
    }, 900)
    return () => clearTimeout(timer)
  }, [modal.type, user, loading, openLogin])

  useEffect(() => {
    if (!user) return
    // 프로필이 마지막으로 동기화한 값과 같으면 매번 다시 쓰지 않는다 (앱 열 때마다 쓰기가 나가는 걸 방지)
    const profile = { email: user.email ?? '', displayName: user.displayName ?? '', photoURL: user.photoURL ?? '' }
    const cacheKey = `reading-notes-profile-synced-${user.uid}`
    if (localStorage.getItem(cacheKey) === JSON.stringify(profile)) return
    upsertUserProfile(user.uid, profile)
      .then(() => localStorage.setItem(cacheKey, JSON.stringify(profile)))
      .catch(() => {})
  }, [user])

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
      const { msg, type } = authErrorMessage(e)
      showToast(msg, type)
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
      syncStatus={syncStatus}
      bookCount={state.books.length}
      collectionCount={state.quotes.length + state.words.length}
      incomingCount={incoming.length}
      onExport={handleExport}
    >
      {tab === 'home' && <HomeTab state={state} userName={cachedName} onFinishBook={handleFinishBook} />}
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
          user={user}
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
