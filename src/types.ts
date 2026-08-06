export type BookStatus = 'wishlist' | 'reading' | 'done'

export interface Book {
  id: string
  title: string
  author: string
  cover: string
  year: string
  status: BookStatus
  rating: number
  review: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  isPrivate?: boolean
}

export interface Quote {
  id: string
  bookId: string | null
  text: string
  page: string
  tags: string[]
  note: string
  createdAt: string
}

export interface Word {
  id: string
  term: string
  meaning: string
  createdAt: string
}

export interface AppState {
  books: Book[]
  quotes: Quote[]
  words: Word[]
  readingGoal?: number
  updatedAt?: string
}

export interface BookPrefill {
  title?: string
  author?: string
  cover?: string
  year?: string | number
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string
  friends?: string[]
}

export interface FriendRequest {
  id: string
  fromUid: string
  toUid: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  profile?: UserProfile
}
