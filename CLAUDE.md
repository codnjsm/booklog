# Booklog — Reading Notes App

## 프로젝트 개요
독서 기록 웹앱. React 18 + TypeScript + Vite, Firebase Hosting + Firestore + Auth.
라우터·상태관리 라이브러리 없음. 상태는 훅 2개(`useData`, `useFriends`)로 관리.

## 기술 스택
- **Frontend**: React 18, TypeScript, Vite (런타임 의존성은 firebase/react/react-dom 뿐)
- **Backend**: Firebase Hosting, Firestore, Google Auth
- **Functions**: Firebase Functions v2 (Node 20, Cloud Run, asia-northeast3) — 카카오 책 검색 / 우리말샘 사전 프록시

## Firebase 프로젝트
- Project ID: `reading-notes-6935e` (`.firebaserc`에 default로 설정됨)
- Hosting URL: https://reading-notes-6935e.web.app

## 주요 구조
```
src/
  components/
    modals/         # AddBookModal, ManualBookModal, BookDetailModal, AddQuoteModal, Modal
    BooksTab, QuotesTab, DictTab, VocabTab, CalendarTab, StatsTab, FriendsTab
    Header, TabBar, BookCard, QuoteCard, DailyQuote, DatePicker, Toast, UserMenu, LoginOverlay
  hooks/
    useAuth.ts      # Firebase Google 로그인
    useData.ts      # 로컬스토리지 + Firestore 동기화, 책/인용구/단어 CRUD, txt 내보내기
    useFriends.ts   # 친구 요청 구독, 친구 책장 로드
  firebase.ts       # Firebase 초기화 + Firestore 접근 함수 전부
  types.ts          # Book, Quote, Word, AppState, UserProfile, FriendRequest
  App.tsx           # 메인 앱, 탭/모달/테마 상태 관리
  index.css         # 전체 스타일 (CSS 변수 기반 다크/라이트 모드)
functions/
  src/index.ts      # kakaoBookSearch, koreanDictSearch
firestore.rules     # Firestore 보안 규칙
```

## 탭 구성
책장 · 인용구 · 사전 · 단어장 · 달력 · 통계 · 친구 (`TabBar.tsx`의 `Tab` 타입)

## 데이터 저장
로컬스토리지 우선 + Firestore 동기화 하이브리드 (`useData.ts`).
- 로컬 키 `reading-notes-data-v1`에 항상 먼저 저장 → 로그인 상태면 300ms 디바운스 후 Firestore 저장
- `updatedAt` 비교로 로컬이 더 최신이면 클라우드 데이터로 덮어쓰지 않음
- 비로그인 상태에서도 로컬 저장만으로 사용 가능

Firestore 컬렉션:
- `reading-notes/{uid}` — 유저의 `AppState` 전체를 문서 하나에 저장 (books/quotes/words/readingGoal)
- `users/{uid}` — 프로필(email, displayName, photoURL). 이메일 친구 검색용
- `friendRequests/{fromUid}_{toUid}` — 친구 요청 status(pending/accepted/rejected)

보안 규칙(`firestore.rules`)의 `isFriend()`로, 친구 관계면 상대의 `reading-notes` 문서를 읽을 수 있음.
친구 책장에서 `isPrivate` 책은 클라이언트에서 필터링됨.

## 외부 API
- 책 검색: 카카오 책 검색 API → `/api/kakaoBookSearch` (Functions 프록시)
- 사전 검색: 우리말샘 오픈 API → `/api/koreanDictSearch` (Functions 프록시)
- API 키는 Firebase Secret Manager (`KAKAO_REST_API_KEY`, `OPENDICT_API_KEY`)

## 테마
- 라이트모드가 기본값 (App.tsx의 초기 테마)
- 다크모드: `:root`, 라이트모드: `[data-theme="light"]` 속성으로 전환
- 포인트 컬러: `--success` (완독 상태 — 파란 계열, 다크 `#4FA3E0` / 라이트 `#2272C3`)

## 상태별 컬러
- 완독: `var(--success)` 블루 — 카드 보더, 뱃지, 필터 칩
- 읽는중/위시리스트: 기본 스타일 (컬러 없음)

## 빌드 & 배포
```bash
npm run build
firebase deploy --only hosting     # 프로젝트는 .firebaserc의 default 사용
firebase deploy --only functions
```
