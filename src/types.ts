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

/** 형광펜 색상 키. 실제 색상값은 index.css의 --highlight-{색} 토큰(테마별)이 갖는다. */
export type HighlightColor = 'lime' | 'pink' | 'sky' | 'mint' | 'lavender'

export interface Quote {
  id: string
  bookId: string | null
  text: string
  page: string
  tags: string[]
  note: string
  createdAt: string
  /** color 없는 구간(과거 데이터)은 lime으로 취급한다. */
  highlights?: { start: number; end: number; color?: HighlightColor }[]
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
      quoteHighlights: { start: number; end: number; color?: HighlightColor }[] | null
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
  /** 좋아요 수. 누른 사람 uid는 서버가 내려주지 않는다. */
  likeCount: number
  /** 내가 눌렀는지. */
  likedByMe: boolean
}

/**
 * 친구가 권한 책 한 건. 서버(getRecommendations)가 보낸 사람 표시정보를 동봉해서 돌려준다.
 * 아직 책이 아니다 — 받는 사람이 담기를 눌러야 Book으로 서재에 들어간다.
 */
export interface Recommendation {
  id: string
  fromUid: string
  fromDisplayName: string
  fromPhotoURL: string
  bookTitle: string
  bookAuthor: string
  bookCover: string
  message: string
  createdAt: string
}

/** 챌린지 한 건. 서버가 날짜 수만 세어 돌려준다 — 무슨 책을 읽었는지는 오지 않는다. */
export interface ChallengeMember {
  uid: string
  displayName: string
  photoURL: string
  days: number
  achieved: boolean
}

export interface Challenge {
  id: string
  ownerUid: string
  from: string
  to: string
  goalDays: number
  /** 기간이 끝났는지 (서울 기준) */
  ended: boolean
  members: ChallengeMember[]
}
