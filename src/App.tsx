import { useCallback, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useData } from './hooks/useData'
import { useFriends } from './hooks/useFriends'
import { upsertUserProfile } from './firebase'
import { AppUIProvider, useAppUI } from './contexts/AppUIContext'
import AppLayout from './components/layout/AppLayout'
import HomeTab from './components/HomeTab'
import BooksTab from './components/BooksTab'
import CollectionTab from './components/CollectionTab'
import RecordsTab from './components/RecordsTab'
import FriendsTab from './components/FriendsTab'
import MoreTab from './components/MoreTab'
import LoginOverlay from './components/LoginOverlay'
import Toast from './components/Toast'
import AddBookModal from './components/modals/AddBookModal'
import ManualBookModal from './components/modals/ManualBookModal'
import BookDetailModal from './components/modals/BookDetailModal'
import AddQuoteModal from './components/modals/AddQuoteModal'
import AddWordModal from './components/modals/AddWordModal'
import PublishPostModal from './components/modals/PublishPostModal'
import AddFriendModal from './components/modals/AddFriendModal'

const queryClient = new QueryClient()

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
  const { user, loading, signIn, signOut, cachedName } = useAuth()
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
  const { tab, modal, showToast, loginDismissed, dismissLogin, openManualBook, openAddQuote, closeModal } = useAppUI()
  const queryClient = useQueryClient()

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
  const handleSignIn = useCallback(async () => {
    try {
      await signIn()
    } catch (e) {
      const err = e as { code?: string }
      showToast(
        err.code === 'auth/popup-closed-by-user' ? '로그인이 취소됐어요' : '로그인 중 오류가 발생했어요',
        err.code === 'auth/popup-closed-by-user' ? 'info' : 'error',
      )
    }
  }, [signIn, showToast])
  const handleSignOut = useCallback(async () => {
    if (!confirm('로그아웃할까요?\n이 기기의 데이터는 그대로 남아있어요.')) return
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
          onExport={handleExport}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
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
          books={state.books}
          quotes={state.quotes}
          onClose={closeModal}
          onPublish={publishPost}
          onPublished={() => queryClient.invalidateQueries({ queryKey: ['friendFeed'] })}
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
          onClose={closeModal}
        />
      )}

      {!loading && !user && !loginDismissed && (
        <LoginOverlay
          onSignIn={handleSignIn}
          onDismiss={() => {
            dismissLogin()
            showToast('로그인 없이 사용 중 · 이 브라우저에만 저장돼요')
          }}
        />
      )}
    </AppLayout>
  )
}
