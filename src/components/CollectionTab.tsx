import { useState } from 'react'
import type { Book, Quote, Word } from '../types'
import QuotesTab from './QuotesTab'
import WordsTab from './WordsTab'
import PageHeader from './layout/PageHeader'

interface Props {
  quotes: Quote[]
  books: Book[]
  words: Word[]
  onDeleteQuote: (id: string) => void
  onAddWord: (data: Omit<Word, 'id' | 'createdAt'>) => void
  onDeleteWord: (id: string) => void
}

export default function CollectionTab({ quotes, books, words, onDeleteQuote, onAddWord, onDeleteWord }: Props) {
  const [view, setView] = useState<'quotes' | 'words'>('quotes')

  const seg = (id: 'quotes' | 'words', label: string) => (
    <button
      onClick={() => setView(id)}
      className={`px-4 py-1.5 rounded-md text-[13px] border-none cursor-pointer transition-colors duration-150 ${
        view === id ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'
      }`}
    >{label}</button>
  )

  return (
    <div>
      <PageHeader title="모음">
        <div className="flex gap-0.5 p-0.5 rounded-[9px] bg-surface2 border border-border">
          {seg('quotes', `문장 ${quotes.length}`)}
          {seg('words', `단어 ${words.length}`)}
        </div>
      </PageHeader>

      {view === 'quotes'
        ? <QuotesTab quotes={quotes} books={books} onDeleteQuote={onDeleteQuote} />
        : <WordsTab words={words} onAddWord={onAddWord} onDeleteWord={onDeleteWord} />}
    </div>
  )
}
