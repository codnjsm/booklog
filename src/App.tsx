import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useData } from './hooks/useData'
import { useFriends } from './hooks/useFriends'
import { upsertUserProfile } from './firebase'
import type { Book, BookPrefill } from './types'
import Header from './components/Header'
import TabBar, { type Tab } from './components/TabBar'
import DailyQuote from './components/DailyQuote'
import BooksTab from './components/BooksTab'
import QuotesTab from './components/QuotesTab'
import DictTab from './components/DictTab'
import VocabTab from './components/VocabTab'
import StatsTab from './components/StatsTab'
import CalendarTab from './components/CalendarTab'
import FriendsTab from './components/FriendsTab'
import LoginOverlay from './components/LoginOverlay'
import UserMenu from './components/UserMenu'
import Toast from './components/Toast'
import AddBookModal from './components/modals/AddBookModal'
import ManualBookModal from './components/modals/ManualBookModal'
import BookDetailModal from './components/modals/BookDetailModal'
import AddQuoteModal from './components/modals/AddQuoteModal'

type Modal =
  | { type: 'none' }
  | { type: 'addBook' }
  | { type: 'manualBook'; prefill?: BookPrefill | Partial<Book>; editId?: string }
  | { type: 'bookDetail'; bookId: string }
  | { type: 'addQuote'; bookId?: string | null; editId?: string }

const THEME_KEY = 'reading-notes-theme'

export default function App() {
  const { user, loading, signIn, signOut } = useAuth()
  const { state, syncStatus, addBook, updateBook, deleteBook, addQuote, updateQuote, deleteQuote, addWord, deleteWord, exportData, setGoal } = useData(user)
  const { friends, incoming, outgoing, searchUser, sendRequest, acceptRequest, rejectRequest, removeRequest, loadFriendBooks } = useFriends(user)

  useEffect(() => {
    if (!user) return
    upsertUserProfile(user.uid, {
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
    }).catch(() => {})
  }, [user])

  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('reading-notes-tab') as Tab) || 'books')
  const [modal, setModal] = useState<Modal>({ type: 'none' })
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null)
  const [loginDismissed, setLoginDismissed] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'light')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal({ type: 'none' }) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const changeTab = useCallback((t: Tab) => { setTab(t); localStorage.setItem('reading-notes-tab', t) }, [])
  const showToast = useCallback((msg: string) => setToast({ msg, key: Date.now() }), [])
  const closeModal = useCallback(() => setModal({ type: 'none' }), [])

  return (
    <div className="max-w-[950px] mx-auto pb-[max(24px,env(safe-area-inset-bottom))]">
      <Header onAddBook={() => setModal({ type: 'addBook' })} onExport={() => { exportData(); showToast('데이터를 내보냈어요') }} onLogoClick={() => changeTab('books')} />
      <DailyQuote key={tab} quotes={state.quotes} books={state.books} />
      <TabBar active={tab} incomingRequestCount={incoming.length} onChange={changeTab} />

      {tab === 'books' && <BooksTab books={state.books} quotes={state.quotes} onBookClick={(id) => setModal({ type: 'bookDetail', bookId: id })} />}
      {tab === 'quotes' && (
        <QuotesTab
          quotes={state.quotes} books={state.books}
          onBookClick={(id) => setModal({ type: 'bookDetail', bookId: id })}
          onEditQuote={(id) => setModal({ type: 'addQuote', editId: id })}
          onDeleteQuote={(id) => { if (!confirm('이 문장을 삭제할까요?')) return; deleteQuote(id); showToast('문장이 삭제됐어요') }}
        />
      )}
      {tab === 'dict' && (
        <DictTab onAddWord={(data) => { addWord(data); showToast('단어가 저장됐어요') }} />
      )}
      {tab === 'vocab' && (
        <VocabTab
          words={state.words}
          onDeleteWord={(id) => { deleteWord(id); showToast('단어가 삭제됐어요') }}
        />
      )}
      {tab === 'calendar' && <CalendarTab books={state.books} onBookClick={(id) => setModal({ type: 'bookDetail', bookId: id })} />}
      {tab === 'stats' && <StatsTab books={state.books} quotes={state.quotes} goal={state.readingGoal} onSetGoal={setGoal} />}
      {tab === 'friends' && (
        <FriendsTab
          user={user}
          authLoading={loading}
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
          onSearch={searchUser}
          onSendRequest={sendRequest}
          onAcceptRequest={acceptRequest}
          onRejectRequest={rejectRequest}
          onRemoveFriend={removeRequest}
          onLoadFriendBooks={loadFriendBooks}
        />
      )}

      <button
        className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] right-3.5 sm:bottom-6 sm:right-6 bg-surface border border-border text-ink w-[42px] h-[42px] sm:w-12 sm:h-12 rounded-full cursor-pointer flex items-center justify-center text-[17px] sm:text-xl transition-all duration-200 p-0 shadow-card z-[90] hover:bg-surface2 hover:-translate-y-0.5 hover:border-dim active:translate-y-0 active:scale-95"
        onClick={() => setTheme((t) => t === 'light' ? 'dark' : 'light')}
        aria-label="테마 전환"
      >
        {theme === 'light' ? '☀️' : '🌙'}
      </button>

      {user && (
        <div ref={userAreaRef}>
          <button
            className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] right-[66px] sm:bottom-6 sm:right-[84px] bg-surface border border-border w-[42px] h-[42px] sm:w-12 sm:h-12 rounded-full cursor-pointer p-0 overflow-hidden shadow-card z-[90] transition-all duration-200 flex items-center justify-center hover:-translate-y-0.5 hover:border-dim"
            onClick={() => setUserMenuOpen((o) => !o)}
            title="계정"
          >
            {user.photoURL
              ? <img src={user.photoURL} referrerPolicy="no-referrer" alt={user.displayName || ''} className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-lg font-semibold text-ink bg-surface2">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
            }
          </button>
          {userMenuOpen && (
            <UserMenu user={user} syncStatus={syncStatus}
              onSignOut={async () => { if (!confirm('로그아웃할까요?\n이 기기의 데이터는 그대로 남아있어요.')) return; await signOut(); setUserMenuOpen(false); showToast('로그아웃됐어요') }}
              onClose={() => setUserMenuOpen(false)}
            />
          )}
        </div>
      )}

      <Toast msg={toast?.msg ?? ''} toastKey={toast?.key} />

      {modal.type === 'addBook' && (
        <AddBookModal onClose={closeModal} onSelectBook={(p) => setModal({ type: 'manualBook', prefill: p })} onManualEntry={() => setModal({ type: 'manualBook' })} />
      )}
      {modal.type === 'manualBook' && (
        <ManualBookModal prefill={modal.prefill} editId={modal.editId} books={state.books} onClose={closeModal}
          onSave={(data, editId) => { if (editId) { updateBook(editId, data); showToast('책이 수정됐어요') } else { addBook(data); showToast('책이 추가됐어요') }; closeModal() }}
        />
      )}
      {modal.type === 'bookDetail' && (
        <BookDetailModal bookId={modal.bookId} books={state.books} quotes={state.quotes} onClose={closeModal}
          onEdit={(id) => { const b = state.books.find((x) => x.id === id); if (b) setModal({ type: 'manualBook', editId: id, prefill: b }) }}
          onDelete={(id) => {
            const b = state.books.find((x) => x.id === id); if (!b) return
            const qc = state.quotes.filter((q) => q.bookId === id).length
            if (!confirm(qc > 0 ? `"${b.title}"을(를) 삭제할까요?\n연결된 인용구 ${qc}개도 함께 사라져요.` : `"${b.title}"을(를) 삭제할까요?`)) return
            deleteBook(id); closeModal(); showToast('책이 삭제됐어요')
          }}
          onAddQuote={(bookId) => setModal({ type: 'addQuote', bookId })}
          onEditQuote={(quoteId) => setModal({ type: 'addQuote', editId: quoteId })}
        />
      )}
      {modal.type === 'addQuote' && (
        <AddQuoteModal books={state.books} quotes={state.quotes} bookId={modal.bookId} editId={modal.editId} onClose={closeModal}
          onSave={(data, editId) => { if (editId) { updateQuote(editId, data); showToast('문장이 수정됐어요') } else { addQuote(data); showToast('문장이 추가됐어요') }; closeModal() }}
          onDelete={(id) => { deleteQuote(id); closeModal(); showToast('문장이 삭제됐어요') }}
        />
      )}

      {!loading && !user && !loginDismissed && (
        <LoginOverlay
          onSignIn={async () => { try { await signIn() } catch (e) { const err = e as { code?: string }; showToast(err.code === 'auth/popup-closed-by-user' ? '로그인이 취소됐어요' : '로그인 중 오류가 발생했어요') } }}
          onDismiss={() => { setLoginDismissed(true); showToast('로그인 없이 사용 중 · 이 브라우저에만 저장돼요') }}
        />
      )}
    </div>
  )
}
