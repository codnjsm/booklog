import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Book, BookPrefill } from '../types'

export type Tab = 'books' | 'quotes' | 'dict' | 'vocab' | 'stats' | 'calendar' | 'friends'

export type Modal =
  | { type: 'none' }
  | { type: 'addBook' }
  | { type: 'manualBook'; prefill?: BookPrefill | Partial<Book>; editId?: string }
  | { type: 'bookDetail'; bookId: string }
  | { type: 'addQuote'; bookId?: string | null; editId?: string }

// Modals that aren't worth a shareable URL (transient create/edit flows) stay in local state.
type LocalModal = Exclude<Modal, { type: 'bookDetail' }>

interface ToastState { msg: string; key: number }

interface AppUIValue {
  tab: Tab
  changeTab: (t: Tab) => void

  modal: Modal
  openAddBook: () => void
  openManualBook: (prefill?: BookPrefill | Partial<Book>, editId?: string) => void
  openBookDetail: (bookId: string) => void
  openAddQuote: (bookId?: string | null, editId?: string) => void
  closeModal: () => void

  theme: 'dark' | 'light'
  toggleTheme: () => void

  toast: ToastState | null
  showToast: (msg: string) => void

  loginDismissed: boolean
  dismissLogin: () => void

  userMenuOpen: boolean
  toggleUserMenu: () => void
  closeUserMenu: () => void
}

const AppUIContext = createContext<AppUIValue | null>(null)

const THEME_KEY = 'reading-notes-theme'

const TAB_PATHS: Record<Tab, string> = {
  books: '/books',
  quotes: '/quotes',
  dict: '/dict',
  vocab: '/vocab',
  calendar: '/calendar',
  stats: '/stats',
  friends: '/friends',
}
const PATH_TABS: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([t, path]) => [path, t as Tab]),
)

export function AppUIProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [localModal, setLocalModal] = useState<LocalModal>({ type: 'none' })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'light')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loginDismissed, setLoginDismissed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const tab: Tab = PATH_TABS[location.pathname] ?? 'books'

  const bookDetailId = searchParams.get('book')
  const modal: Modal = bookDetailId && localModal.type === 'none'
    ? { type: 'bookDetail', bookId: bookDetailId }
    : localModal

  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const clearBookParam = useCallback((opts?: { replace?: boolean }) => {
    if (!searchParams.has('book')) return
    const next = new URLSearchParams(searchParams)
    next.delete('book')
    setSearchParams(next, opts)
  }, [searchParams, setSearchParams])

  const changeTab = useCallback((t: Tab) => navigate(TAB_PATHS[t]), [navigate])

  const closeModal = useCallback(() => {
    setLocalModal({ type: 'none' })
    clearBookParam({ replace: true })
  }, [clearBookParam])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeModal])

  const openAddBook = useCallback(() => { clearBookParam(); setLocalModal({ type: 'addBook' }) }, [clearBookParam])
  const openManualBook = useCallback((prefill?: BookPrefill | Partial<Book>, editId?: string) => {
    clearBookParam()
    setLocalModal({ type: 'manualBook', prefill, editId })
  }, [clearBookParam])
  const openBookDetail = useCallback((bookId: string) => {
    setLocalModal({ type: 'none' })
    const next = new URLSearchParams(searchParams)
    next.set('book', bookId)
    setSearchParams(next)
  }, [searchParams, setSearchParams])
  const openAddQuote = useCallback((bookId?: string | null, editId?: string) => {
    clearBookParam()
    setLocalModal({ type: 'addQuote', bookId, editId })
  }, [clearBookParam])

  const toggleTheme = useCallback(() => setTheme((t) => t === 'light' ? 'dark' : 'light'), [])
  const showToast = useCallback((msg: string) => setToast({ msg, key: Date.now() }), [])
  const dismissLogin = useCallback(() => setLoginDismissed(true), [])
  const toggleUserMenu = useCallback(() => setUserMenuOpen((o) => !o), [])
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), [])

  const value: AppUIValue = useMemo(() => ({
    tab, changeTab,
    modal, openAddBook, openManualBook, openBookDetail, openAddQuote, closeModal,
    theme, toggleTheme,
    toast, showToast,
    loginDismissed, dismissLogin,
    userMenuOpen, toggleUserMenu, closeUserMenu,
  }), [tab, changeTab, modal, openAddBook, openManualBook, openBookDetail, openAddQuote, closeModal, theme, toggleTheme, toast, showToast, loginDismissed, dismissLogin, userMenuOpen, toggleUserMenu, closeUserMenu])

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
}

export function useAppUI() {
  const ctx = useContext(AppUIContext)
  if (!ctx) throw new Error('useAppUI must be used within AppUIProvider')
  return ctx
}
