# Booklog

독서 기록 웹앱. 읽은 책과 인상 깊은 문장을 기록하고, 친구와 책장을 공유합니다.

**https://reading-notes-6935e.web.app**

## 주요 기능

- **홈** — 오늘의 독서 목표 진행률, 지금 읽는 중인 책, 오늘의 문장, 최근 활동 피드
- **서재** — 위시리스트 / 읽는중 / 완독 상태로 책 관리, 별점·독후감·비공개 설정(친구에게 숨기기)
- **모음** — 책에서 발췌한 인용구(형광펜으로 부분 강조 가능) + 우리말샘 사전 검색·단어장을 한 화면에서
- **기록** — 완독 달력, 최근 12개월 완독 추이, 연간 독서 목표
- **친구** — 이메일로 친구 추가, 서로의 책장 열람(비공개 책 제외)
- Google 로그인 시 기기 간 동기화, 로그인 없이도 브라우저 로컬 저장으로 사용 가능
- 다크/라이트 테마, 데스크톱 사이드바 / 모바일 하단 탭 네비게이션

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **상태 관리**: React Context(전역 UI 상태) + `@tanstack/react-query`(서버 상태) + `react-router-dom`(URL 상태)
- **Backend**: Firebase Hosting, Firestore, Google Auth
- **Functions**: Firebase Functions v2 — 카카오 책 검색 / 우리말샘 사전 프록시

## 시작하기

```bash
npm install
npm run dev
```

`http://localhost:5173`에서 확인. Firebase 클라이언트 설정은 `src/firebase.ts`에 포함되어 있어 별도 `.env` 없이 바로 실행됩니다. 다만 책 검색·사전 검색은 Firebase Functions 프록시를 거치므로, 로컬 개발 서버만으로는 두 기능이 동작하지 않습니다(배포 환경에서만 정상 동작).

## 빌드 & 배포

```bash
npm run build
firebase deploy --only hosting     # 프로젝트는 .firebaserc의 default(reading-notes-6935e) 사용
firebase deploy --only functions
```

## 프로젝트 구조

```
src/
  components/
    layout/           # AppLayout(사이드바/하단탭), PageHeader, icons
    modals/            # AddBookModal, ManualBookModal, BookDetailModal, AddQuoteModal, Modal
    HomeTab, BooksTab, CollectionTab, RecordsTab, FriendsTab, MoreTab
    QuotesTab, WordsTab, StatsTab, CalendarTab   # CollectionTab/RecordsTab 안에서 조합
    BookCard, QuoteCard, HighlightedText, DatePicker, Toast, LoginOverlay
  contexts/
    AppUIContext.tsx  # 탭(URL 라우팅)/모달/테마/토스트 등 전역 UI 상태
  hooks/
    useAuth.ts        # Firebase Google 로그인
    useData.ts        # 로컬스토리지 + Firestore 동기화, 책/인용구/단어 CRUD
    useFriends.ts     # 친구 요청 구독, 친구 책장 로드
  lib/
    insights.ts        # 홈 대시보드용 파생 지표(목표 페이스, 최근 활동 등)
  firebase.ts          # Firebase 초기화 + Firestore 접근 함수
  types.ts             # Book, Quote, Word, AppState 등 타입
functions/
  src/index.ts         # kakaoBookSearch, koreanDictSearch
firestore.rules         # Firestore 보안 규칙
```

더 자세한 아키텍처 설명은 [CLAUDE.md](CLAUDE.md) 참고.
