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
  /** 실제로 읽은 날짜(YYYY-MM-DD, 오름차순). startedAt/finishedAt은 이 중 첫날/마지막날로 파생된다. */
  readDates?: string[]
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
  highlights?: { start: number; end: number }[]
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

/**
 * 친구 책장. 서버(getFriendShelf)가 공개 범위만 골라 준 것이라
 * Book보다 좁다 — 독후감(review)·연도는 오지 않고, 비공개 책은 아예 빠져 있다.
 */
export interface FriendBook {
  id: string
  title: string
  author: string
  cover: string
  status: BookStatus
  rating: number
  startedAt: string | null
  finishedAt: string | null
}

export interface FriendShelf {
  books: FriendBook[]
  readingGoal: number
}

/** 게시물의 첨부 — createPost 호출 시 서버가 만들어주는 스냅샷 모양과 같다. */
export type PostAttachment =
  | {
      kind: 'quote'
      quoteText: string
      quoteHighlights: { start: number; end: number }[] | null
      bookTitle: string | null
      bookAuthor: string | null
    }
  | {
      kind: 'book'
      bookTitle: string
      bookAuthor: string
      bookCover: string
      bookStatus: BookStatus
      bookRating: number
    }

/** 친구 피드에 뜨는 게시물 한 건. getFriendFeed가 작성자 표시정보를 동봉해서 돌려준다. */
export interface Post {
  id: string
  authorUid: string
  createdAt: string
  caption: string
  attachment: PostAttachment
  authorDisplayName: string
  authorPhotoURL: string
}
