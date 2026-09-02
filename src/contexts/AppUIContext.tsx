import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Book, BookPrefill } from '../types'

export type Tab = 'books' | 'quotes' | 'dict' | 'vocab' | 'stats' | 'calendar' | 'friends'

export type Modal =
  | { type: 'none' }
  | { type: 'addBook' }
  | { type: 'manualBook'; prefill?: BookPrefill | Partial<Book>; editId?: string }
  | { type: 'bookDetail'; bookId: string }
  | { type: 'addQuote'; bookId?: string | null; editId?: string }

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

const TAB_KEY = 'reading-notes-tab'
const THEME_KEY = 'reading-notes-theme'

export function AppUIProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(TAB_KEY) as Tab) || 'books')
  const [modal, setModal] = useState<Modal>({ type: 'none' })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'light')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loginDismissed, setLoginDismissed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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

  const changeTab = useCallback((t: Tab) => { setTab(t); localStorage.setItem(TAB_KEY, t) }, [])
  const closeModal = useCallback(() => setModal({ type: 'none' }), [])
  const openAddBook = useCallback(() => setModal({ type: 'addBook' }), [])
  const openManualBook = useCallback((prefill?: BookPrefill | Partial<Book>, editId?: string) => setModal({ type: 'manualBook', prefill, editId }), [])
  const openBookDetail = useCallback((bookId: string) => setModal({ type: 'bookDetail', bookId }), [])
  const openAddQuote = useCallback((bookId?: string | null, editId?: string) => setModal({ type: 'addQuote', bookId, editId }), [])
  const toggleTheme = useCallback(() => setTheme((t) => t === 'light' ? 'dark' : 'light'), [])
  const showToast = useCallback((msg: string) => setToast({ msg, key: Date.now() }), [])
  const dismissLogin = useCallback(() => setLoginDismissed(true), [])
  const toggleUserMenu = useCallback(() => setUserMenuOpen((o) => !o), [])
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), [])

  const value: AppUIValue = {
    tab, changeTab,
    modal, openAddBook, openManualBook, openBookDetail, openAddQuote, closeModal,
    theme, toggleTheme,
    toast, showToast,
    loginDismissed, dismissLogin,
    userMenuOpen, toggleUserMenu, closeUserMenu,
  }

  return <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
}

export function useAppUI() {
  const ctx = useContext(AppUIContext)
  if (!ctx) throw new Error('useAppUI must be used within AppUIProvider')
  return ctx
}
