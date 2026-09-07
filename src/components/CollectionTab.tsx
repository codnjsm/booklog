import { useState } from 'react'
import type { Book, Quote, Word } from '../types'
import QuotesTab from './QuotesTab'
import WordsTab from './WordsTab'
import PageHeader from './layout/PageHeader'
import { useAppUI } from '../contexts/AppUIContext'

interface Props {
  quotes: Quote[]
  books: Book[]
  words: Word[]
  onDeleteQuote: (id: string) => void
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
  onDeleteWord: (id: string) => void
}

export default function CollectionTab({ quotes, books, words, onDeleteQuote, onAddWord, onDeleteWord }: Props) {
  const { openAddQuote } = useAppUI()
  const [view, setView] = useState<'quotes' | 'words'>('quotes')

  const seg = (id: 'quotes' | 'words', label: string) => (
    <button
      onClick={() => setView(id)}
      className={`flex-1 sm:flex-none sm:px-6 py-1.5 rounded-md text-[13px] border-none cursor-pointer transition-colors duration-150 ${
        view === id ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <PageHeader title="모음">
        {view === 'quotes' && (
          <button
            onClick={() => openAddQuote()}
            className="text-xs sm:text-[13px] font-medium px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg bg-ink text-bg border-none cursor-pointer hover:opacity-90"
          >
            + 문장 저장
          </button>
        )}
      </PageHeader>

      <div className="flex gap-0.5 p-0.5 mb-2.5 rounded-[9px] bg-surface2 border border-border sm:w-fit">
        {seg('quotes', `문장 ${quotes.length}`)}
        {seg('words', `단어 ${words.length}`)}
      </div>

      {view === 'quotes' ? (
        <QuotesTab quotes={quotes} books={books} onDeleteQuote={onDeleteQuote} />
      ) : (
        <WordsTab words={words} onAddWord={onAddWord} onDeleteWord={onDeleteWord} />
      )}
    </div>
  )
}
