import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Book, BookPrefill } from '../types'

export type Tab = 'home' | 'books' | 'collection' | 'records' | 'friends' | 'more'

export type Modal =
  | { type: 'none' }
  | { type: 'addBook' }
  | { type: 'manualBook'; prefill?: BookPrefill | Partial<Book>; editId?: string }
  | { type: 'bookDetail'; bookId: string }
  | { type: 'addQuote'; bookId?: string | null; editId?: string }
  | { type: 'addWord' }
  | { type: 'publishPost' }
  | { type: 'addFriend' }
  | { type: 'welcome' }

// Modals that aren't worth a shareable URL (transient create/edit flows) stay in local state.
type LocalModal = Exclude<Modal, { type: 'bookDetail' }>

/** 'info'는 안내/취소 같은 중립 메시지의 기본값이다 — 완료도 실패도 아닌 걸 성공(초록 체크)으로
 * 잘못 표시하지 않기 위해 명시적으로 골라야만 success/error가 된다. */
export type ToastType = 'success' | 'error' | 'info'

interface ToastState {
  msg: string
  type: ToastType
  key: number
}

interface AppUIValue {
  tab: Tab
  changeTab: (t: Tab) => void

  modal: Modal
  openAddBook: () => void
  openManualBook: (prefill?: BookPrefill | Partial<Book>, editId?: string) => void
  openBookDetail: (bookId: string) => void
  openAddQuote: (bookId?: string | null, editId?: string) => void
  openAddWord: () => void
  openPublishPost: () => void
  openAddFriend: () => void
  openWelcome: () => void
  closeModal: () => void

  theme: 'dark' | 'light'
  toggleTheme: () => void

  toast: ToastState | null
  showToast: (msg: string, type?: ToastType) => void

  loginDismissed: boolean
  dismissLogin: () => void

  userMenuOpen: boolean
  toggleUserMenu: () => void
  closeUserMenu: () => void
}

const AppUIContext = createContext<AppUIValue | null>(null)

const THEME_KEY = 'reading-notes-theme'

const TAB_PATHS: Record<Tab, string> = {
  home: '/',
  books: '/books',
  collection: '/collection',
  records: '/records',
  friends: '/friends',
  more: '/more',
}
const PATH_TABS: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([t, path]) => [path, t as Tab]),
)

export function AppUIProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [localModal, setLocalModal] = useState<LocalModal>({ type: 'none' })
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'light',
  )
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loginDismissed, setLoginDismissed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const tab: Tab = PATH_TABS[location.pathname] ?? 'home'

  const bookDetailId = searchParams.get('book')
  const modal: Modal =
    bookDetailId && localModal.type === 'none' ? { type: 'bookDetail', bookId: bookDetailId } : localModal

  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const clearBookParam = useCallback(
    (opts?: { replace?: boolean }) => {
      if (!searchParams.has('book')) return
      const next = new URLSearchParams(searchParams)
      next.delete('book')
      setSearchParams(next, opts)
    },
    [searchParams, setSearchParams],
  )

  const changeTab = useCallback((t: Tab) => navigate(TAB_PATHS[t]), [navigate])

  const closeModal = useCallback(() => {
    setLocalModal({ type: 'none' })
    clearBookParam({ replace: true })
  }, [clearBookParam])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeModal])

  const openAddBook = useCallback(() => {
    clearBookParam()
    setLocalModal({ type: 'addBook' })
  }, [clearBookParam])
  const openManualBook = useCallback(
    (prefill?: BookPrefill | Partial<Book>, editId?: string) => {
      clearBookParam()
      setLocalModal({ type: 'manualBook', prefill, editId })
    },
    [clearBookParam],
  )
  const openBookDetail = useCallback(
    (bookId: string) => {
      setLocalModal({ type: 'none' })
      const next = new URLSearchParams(searchParams)
      next.set('book', bookId)
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )
  const openAddQuote = useCallback(
    (bookId?: string | null, editId?: string) => {
      clearBookParam()
      setLocalModal({ type: 'addQuote', bookId, editId })
    },
    [clearBookParam],
  )
  const openAddWord = useCallback(() => {
    clearBookParam()
    setLocalModal({ type: 'addWord' })
  }, [clearBookParam])
  const openPublishPost = useCallback(() => {
    clearBookParam()
    setLocalModal({ type: 'publishPost' })
  }, [clearBookParam])
  const openAddFriend = useCallback(() => {
    clearBookParam()
    setLocalModal({ type: 'addFriend' })
  }, [clearBookParam])
  const openWelcome = useCallback(() => {
    clearBookParam()
    setLocalModal({ type: 'welcome' })
  }, [clearBookParam])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])
  const showToast = useCallback((msg: string, type: ToastType = 'info') => setToast({ msg, type, key: Date.now() }), [])
  const dismissLogin = useCallback(() => setLoginDismissed(true), [])
  const toggleUserMenu = useCallback(() => setUserMenuOpen((o) => !o), [])
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), [])

  const value: AppUIValue = useMemo(
    () => ({
      tab,
      changeTab,
      modal,
      openAddBook,
      openManualBook,
      openBookDetail,
      openAddQuote,
      openAddWord,
      openPublishPost,
      openAddFriend,
      openWelcome,
      closeModal,
      theme,
      toggleTheme,
      toast,
      showToast,
      loginDismissed,
      dismissLogin,
      userMenuOpen,
      toggleUserMenu,
      closeUserMenu,
    }),
    [
      tab,
      changeTab,
      modal,
      openAddBook,
      openManualBook,
      openBookDetail,
      openAddQuote,
      openAddWord,
      openPublishPost,
      openAddFriend,
      openWelcome,
      closeModal,
      theme,
      toggleTheme,
      toast,
      showToast,
      loginDismissed,
      dismissLogin,
      userMenuOpen,
      toggleUserMenu,
      closeUserMenu,
    ],
  )

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
}

export function useAppUI() {
  const ctx = useContext(AppUIContext)
  if (!ctx) throw new Error('useAppUI must be used within AppUIProvider')
  return ctx
}
