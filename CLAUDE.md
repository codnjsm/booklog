# Booklog — Reading Notes App

## 프로젝트 개요

독서 기록 웹앱. React 18 + TypeScript + Vite, Firebase Hosting + Firestore + Auth.
상태는 세 갈래로 나뉜다: 지역(useState) / 전역 UI(`AppUIContext`) / 서버(`useData`, `useFriends`, 일부는 React Query).

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **상태 관리**: React Context(전역 UI 상태) + `@tanstack/react-query`(서버 상태) + `react-router-dom`(URL 상태 — 탭 전환이 라우팅)
- **Backend**: Firebase Hosting, Firestore, Google Auth
- **Functions**: Firebase Functions v2 (Node 20, Cloud Run, asia-northeast3) — 카카오 책 검색 / 우리말샘 사전 프록시

## Firebase 프로젝트

- Project ID: `reading-notes-6935e` (`.firebaserc`에 default로 설정됨)
- Hosting URL: https://reading-notes-6935e.web.app

## 주요 구조

```
src/
  components/
    layout/           # AppLayout(데스크톱 사이드바 / 모바일 하단탭), PageHeader, icons
    modals/            # AddBookModal, ManualBookModal, BookDetailModal, AddQuoteModal, Modal
    HomeTab, BooksTab, CollectionTab, RecordsTab, FriendsTab, MoreTab   # 탭(=라우트) 컴포넌트
    QuotesTab, WordsTab, StatsTab, CalendarTab   # CollectionTab(모음)·RecordsTab(기록) 내부에서 조합
    BookCard, QuoteCard, HighlightedText, DatePicker, Toast, LoginOverlay
  contexts/
    AppUIContext.tsx  # 탭(URL과 동기화)/모달/테마/토스트/로그인 배너 등 전역 UI 상태
  hooks/
    useAuth.ts        # Firebase Google 로그인
    useData.ts        # 로컬스토리지 + Firestore 동기화, 책/인용구/단어 CRUD, txt 내보내기
    useFriends.ts     # 친구 요청 구독, 친구 책장 로드
  lib/
    insights.ts        # 홈 대시보드 파생 지표(목표 페이스, 이번 주 기록한 날, 최근 활동 등)
  firebase.ts          # Firebase 초기화 + Firestore 접근 함수 전부
  types.ts             # Book, Quote, Word, AppState, UserProfile, FriendRequest
  App.tsx              # QueryClientProvider + BrowserRouter + AppUIProvider 조립, 모달 라우팅
  index.css            # CSS 변수(디자인 토큰) 정의. 실제 스타일은 컴포넌트의 Tailwind 클래스
functions/
  src/index.ts         # kakaoBookSearch, koreanDictSearch
firestore.rules         # Firestore 보안 규칙
```

## 탭 구성

홈 · 서재 · 모음(인용구+사전/단어장) · 기록(달력+통계) · 친구 · 더보기 (`AppUIContext.tsx`의 `Tab` 타입)

- 탭은 URL과 동기화된다 (`/`, `/books`, `/collection`, `/records`, `/friends`, `/more`). 새로고침해도 탭이 유지됨.
- 첫 화면은 항상 홈(`/`)으로 고정.
- 데스크톱(`sm:` = 900px 이상)은 좌측 사이드바에 6개 전부, 모바일은 하단 탭 5개(친구는 더보기 안으로).
- 모달 중 책 상세(`bookDetail`)는 `?book=` 쿼리파라미터로 열림/닫힘이 URL에 반영됨. 나머지 모달은 로컬 상태.

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

## 인용구 형광펜

`Quote.highlights?: { start: number; end: number }[]` — 문장 안에서 사용자가 표시한 구간(복수 가능)을 저장.

- 저장 시 겹치거나 맞닿은 구간은 하나로 합침 (`HighlightedText.tsx`의 `mergeRanges`)
- 렌더 시 인덱스를 항상 현재 문장 길이로 clamp (문장을 나중에 수정해도 깨지지 않게)
- `AddQuoteModal`에서 textarea 선택 후 지정. 저장 시 `text.trim()`으로 잘려나간 만큼 인덱스 보정
- `Quote.tags` 필드는 남아있지만 입력 UI는 없음 (태그 기능은 제거됨, 항상 빈 배열로 저장)

## 외부 API

- 책 검색: 카카오 책 검색 API → `/api/kakaoBookSearch` (Functions 프록시)
- 사전 검색: 우리말샘 오픈 API → `/api/koreanDictSearch` (Functions 프록시)
- API 키는 Firebase Secret Manager (`KAKAO_REST_API_KEY`, `OPENDICT_API_KEY`)
- 로컬 개발 서버(`npm run dev`)만으로는 두 검색이 동작하지 않음 (배포 환경에서만 프록시 경로가 살아있음)

## 테마 & 디자인 토큰

- **라이트가 기본값** — `:root`가 라이트, `[data-theme="dark"]` 속성으로 다크 전환 (반대 아님)
- 팔레트: Ink & Paper — 차가운 무채색 + 잉크 블루 accent 하나. 토큰은 `src/index.css`의 CSS 변수, Tailwind 클래스명은 `tailwind.config.js`에서 매핑 (`bg/surface/surface2/border/ink/dim/accent/accenthover/accentsoft/danger/ok/highlight`)
- **accent** = 앱이 말하는 것(완료 뱃지, 진행률, 활성 메뉴, 주요 버튼). **highlight(형광)** = 사용자가 표시한 것(인용구 부분 강조, 이번 주에 담은 단어). 두 색은 의미가 겹치지 않게 분리되어 있음
- 디자인 작업 시 `~/.claude/skills/app-design/SKILL.md` 참고 (색 역할, 형광 사용 규칙, 레이아웃 함정 등)

## 상태별 컬러

- 완독 → `accent`로 채운 뱃지
- 읽는중 → `ink` 아웃라인 뱃지
- 위시리스트 → `dim` 아웃라인 뱃지

## 반응형

- Tailwind `sm:` 브레이크포인트를 900px로 커스텀 (`tailwind.config.js`). 기본값 640px가 아님에 유의.
- 본문 최대 너비 1200px, `mx-auto`로 가운데 정렬 (`AppLayout.tsx`)

## 빌드 & 배포

```bash
npm run build
firebase deploy --only hosting     # 프로젝트는 .firebaserc의 default 사용
firebase deploy --only functions
```

## 코드 포맷

Prettier가 포맷 기준이다 (`.prettierrc`: 작은따옴표, 세미콜론 없음, printWidth 120).
편집기의 자동 포맷도 이 설정을 따르므로 저장할 때마다 스타일이 뒤집히지 않는다.

```bash
npm run format         # 전체 포맷
npm run format:check   # 포맷 위반만 확인
```

이전에는 설정이 없어서 편집기가 파일 전체를 재포맷했고, 5줄 수정이 236줄 커밋으로
번진 적이 있다. 그래서 지금도 커밋 전 `git diff --stat`으로 변경 범위가 의도한
만큼인지 한 번 보는 습관은 유지할 것.
