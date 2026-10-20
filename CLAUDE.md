# Booklog — Reading Notes App

## 프로젝트 개요

독서 기록 웹앱. React 18 + TypeScript + Vite, Firebase Hosting + Firestore + Auth + Cloud Messaging.
상태는 세 갈래로 나뉜다: 지역(useState) / 전역 UI(`AppUIContext`) / 서버(`useData`, `useFriends`, 일부는 React Query).

친구 기능은 알림함·좋아요·댓글·책 권하기·독서 챌린지까지 들어가 있고, 홈 화면에 추가하면 웹 푸시로
앱을 열지 않아도 알림을 받는다. 기능 단계별 설계와 결정 기록은 `BOOKLOG_PHASE2.md` 참고.

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **상태 관리**: React Context(전역 UI 상태) + `@tanstack/react-query`(서버 상태) + `react-router-dom`(URL 상태 — 탭 전환이 라우팅)
- **Backend**: Firebase Hosting, Firestore, Google Auth
- **Functions**: Firebase Functions v2 (Node 22, Cloud Run, asia-northeast3) — 외부 API 프록시 2개(`onRequest`) +
  콜러블 23개. 친구·피드·좋아요·댓글·책 권하기·독서 챌린지·알림 발송·사진 문장 인식(OCR)·회원 탈퇴
- **테스트**: 프론트는 vitest(`npm test`), 서버 핸들러와 보안 규칙은 Firestore 에뮬레이터(`npm run test:rules`)

## Firebase 프로젝트

- Project ID: `reading-notes-6935e` (`.firebaserc`에 default로 설정됨)
- Hosting URL: https://reading-notes-6935e.web.app

## 주요 구조

```
src/
  components/
    layout/           # AppLayout(데스크톱 사이드바 / 모바일 하단탭), PageHeader, icons
    modals/            # AddBookModal, ManualBookModal, BookDetailModal, AddQuoteModal, AddWordModal,
                       # AddFriendModal, PublishPostModal, WelcomeModal, Modal,
                       # RecommendBookModal, CreateChallengeModal, PostLikesModal, LoginModal,
                       # DeleteAccountModal, EmailChangeModal, NameEditModal, AvatarCropModal
    HomeTab, BooksTab, CollectionTab, RecordsTab, FriendsTab, MoreTab   # 탭(=라우트) 컴포넌트
    QuotesTab, WordsTab, StatsTab, CalendarTab   # CollectionTab(모음)·RecordsTab(기록) 내부에서 조합
    ChallengeSection             # RecordsTab 안의 독서 챌린지 영역
    NotificationBell             # 알림함. 모바일 상단 서비스명 줄 / 데스크톱 사이드바 로고 줄
    PostCard, PostLikes, PostComments            # 피드 카드와 좋아요·댓글
    BookCard, QuoteCard, HighlightedText, DatePicker, DateMultiPicker, Toast, LoginOverlay
  contexts/
    AppUIContext.tsx  # 탭(URL과 동기화)/모달/테마/토스트/로그인 배너 등 전역 UI 상태
  hooks/
    useAuth.ts        # Firebase Google 로그인
    useData.ts        # 로컬스토리지 + Firestore 동기화, 책/인용구/단어 CRUD, txt 내보내기
    useFriends.ts     # 친구 요청 구독, 친구 책장 로드, 피드 게시물 발행·조회·삭제, 책 권하기
    usePush.ts        # 알림 권한·기기 등록 상태 (켜기/끄기/미지원/설치 필요)
  lib/
    insights.ts        # 홈 대시보드 파생 지표(목표 페이스, 이번 주 기록한 날, 최근 활동, relativeDay)
    day.ts             # 날짜 기준 — 저장은 UTC, 표시는 기기 지역시간 (아래 「날짜 다루기」)
    notifications.ts   # 알림 목록 구성, 읽음·지움 처리
    push.ts            # 웹 푸시 상태 판단 (VAPID 공개키, 기기 토큰)
    install.ts         # 홈 화면 추가 안내를 보여줄지 판단
    serviceWorker.ts   # 서비스워커 등록과 탈출구(?sw-off / ?sw-on)
    recommend.ts       # 읽은 책 기반 추천
    browser.ts         # 로컬 저장이 지워질 수 있는 브라우저 판별(ITP)
    image.ts           # 사진 리사이즈
  firebase.ts          # Firebase 초기화 + Firestore 접근 함수 전부
  types.ts             # Book, Quote, Word, AppState, UserProfile, FriendRequest, Post, PostAttachment, FriendShelf
  App.tsx              # QueryClientProvider + BrowserRouter + AppUIProvider 조립, 모달 라우팅
  index.css            # CSS 변수(디자인 토큰) 정의. 실제 스타일은 컴포넌트의 Tailwind 클래스
  public/sw.js         # 푸시 수신 서비스워커. **캐시도 fetch 핸들러도 두지 않는다**
functions/
  src/index.ts         # kakaoBookSearch, koreanDictSearch (onRequest 프록시)
                       # 친구: findUserByEmail, getFriendShelf
                       # 피드: createPost, getFriendFeed, deletePost, toggleLike, getPostLikes
                       # 댓글: addComment, deleteComment, getComments
                       # 권하기: recommendBook, getRecommendations, respondRecommendation
                       # 챌린지: createChallenge, inviteToChallenge, joinChallenge, declineChallenge,
                       #         getChallengeDetail, listChallenges, deleteChallenge
                       # 알림: dismissNotifications, onFriendRequestCreated, onFriendRequestAccepted
                       # 기타: ocrBookPage, deleteAccount
firestore.rules         # Firestore 보안 규칙
tests/                  # 에뮬레이터로 도는 서버 핸들러·보안 규칙 테스트
docs/
  GLOSSARY.md           # 용어 정의 (기록 / 공유하기 / 게시물 / 첨부 / 피드)
  decisions/            # 되돌리기 어려운 결정의 배경. 코드 주석이 여기를 가리킨다
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
- `posts/{postId}` — 친구 피드에 공유한 게시물(문장 또는 책 스냅샷). `createPost`/`getFriendFeed`/`deletePost` Functions로만 쓰고 읽음
- `posts/{postId}/comments/{commentId}` — 댓글. **하위 컬렉션은 상위 규칙을 물려받지 않으므로 따로 막아뒀다**
- `notifications/{uid}/items/{itemId}` — 알림함. 읽기만 본인 허용, 쓰기는 서버만
- `recommendations/{recId}` — 친구에게 권한 책. 서버만 읽고 씀
- `challenges/{challengeId}` — 독서 챌린지. 서버만 읽고 씀
- `users/{uid}/fcmTokens/{tokenId}` — 푸시 기기 주소. **친구가 `users/{uid}`를 읽을 수 있어서 하위 컬렉션으로 뺐다**
- `users/{uid}/badges/{badgeId}` — 챌린지 완주 뱃지

**친구는 남의 `reading-notes` 문서를 직접 읽지 못한다.** 규칙은 본인만 허용한다
(`allow read, write: if signedIn() && request.auth.uid == userId`).
보안 규칙은 문서 단위로만 막을 수 있어서, 한 문서에 섞여 있는 비공개 책·인용구·독후감만 골라 가릴 수 없다.
그래서 친구에게 보여줄 공개 범위는 **서버(`getFriendShelf` 콜러블)가 고른다.**
클라이언트 필터링에 기대지 않는다 — 버그 하나가 곧 유출이 되기 때문이다.
배경: `docs/decisions/260907-132332-friend-data-behind-callable.md`

## 날짜 다루기

**이 영역에서 버그가 두 번 났다. 날짜를 만질 때는 아래를 먼저 읽을 것.**

- **저장은 UTC(`toISOString`), 표시는 기기 지역시간.** 앞 10자를 그냥 자르면(`toISOString().slice(0,10)`)
  UTC 날짜가 나와서 한국 새벽(자정~오전 9시) 기록이 전날로 잡힌다. `lib/day.ts`의 `toDayString`·`isoToDay`·`today`를 쓸 것
- **「오늘·어제」는 경과 시간이 아니라 달력 날짜로 센다** (`insights.ts`의 `relativeDay`).
  시간 차를 86400000으로 나누면 어제 저녁 8시에 쓴 글이 오늘 아침에 「오늘」로 보인다.
  양쪽을 그 기기의 자정으로 떨군 뒤 뺀다
- **날짜만 있는 문자열(`YYYY-MM-DD`)을 `new Date()`에 넣지 말 것.** UTC 자정으로 읽혀서 시간대에 따라 하루가 밀린다.
  `isoToDay`는 길이가 10이면 그대로 돌려준다
- 서버(Functions)는 사용자 기기 시간을 모르므로 **서울 기준(+9h) 고정**이다. 클라이언트와 규칙이 다른 게 의도된 것

## 인용구 형광펜

`Quote.highlights?: { start: number; end: number; color?: HighlightColor }[]` — 문장 안에서 사용자가 표시한 구간(복수 가능)을 저장. `HighlightColor`는 `lime | pink | sky | mint | lavender` 5종(`types.ts`), `color` 없는 구간(과거 데이터)은 lime으로 취급.

- 저장 시 겹치거나 맞닿은 구간은 같은 색끼리만 하나로 합침 (`HighlightedText.tsx`의 `mergeRanges`)
- 렌더 시 인덱스를 항상 현재 문장 길이로 clamp (문장을 나중에 수정해도 깨지지 않게)
- `AddQuoteModal`에서 textarea 선택 후 색상을 골라 지정. 저장 시 `text.trim()`으로 잘려나간 만큼 인덱스 보정
- `Quote.tags` 필드는 남아있지만 입력 UI는 없음 (태그 기능은 제거됨, 항상 빈 배열로 저장)

## 외부 API

- 책 검색: 카카오 책 검색 API → `/api/kakaoBookSearch` (Functions 프록시)
- 사전 검색: 우리말샘 오픈 API → `/api/koreanDictSearch` (Functions 프록시)
- 문장 인식(OCR): Google Cloud Vision(`documentTextDetection`) → `ocrBookPage` 콜러블. 인식된 텍스트만 반환하고 이미지는 저장하지 않음. 서비스 계정 권한으로 호출하므로 별도 API 키 불필요
- API 키는 Firebase Secret Manager (`KAKAO_REST_API_KEY`, `OPENDICT_API_KEY`)
- 로컬 개발 서버(`npm run dev`)만으로는 세 기능이 동작하지 않음 (배포 환경에서만 프록시/콜러블 경로가 살아있음)

## 테마 & 디자인 토큰

- **라이트가 기본값** — `:root`가 라이트, `[data-theme="dark"]` 속성으로 다크 전환 (반대 아님)
- 팔레트: Ink & Paper — 차가운 무채색 + 잉크 블루 accent 하나. 토큰은 `src/index.css`의 CSS 변수, Tailwind 클래스명은 `tailwind.config.js`에서 매핑 (`bg/surface/surface2/border/ink/dim/accent/accenthover/accentsoft/danger/ok/highlight`)
- **accent** = 앱이 말하는 것(완료 뱃지, 진행률, 활성 메뉴, 주요 버튼). **highlight(형광)** = 사용자가 표시한 것(인용구 부분 강조, 이번 주에 담은 단어). 두 색은 의미가 겹치지 않게 분리되어 있음
- 디자인 작업 시 `~/.claude/skills/app-design/SKILL.md` 참고 (색 역할, 형광 사용 규칙, 레이아웃 함정 등)

**자주 걸리는 함정** — `accentsoft` 카드 위에 `accentsoft` 버튼을 두면 버튼이 배경에 묻혀 안 보인다.
중간 톤 토큰이 없어서 그렇다. 연한 파랑 카드 위의 버튼은 `accentfill`(진한 파랑)로 하거나,
카드 배경을 `surface2`(회색)로 내릴 것.

## 상태별 컬러

- 완독 → `accent`로 채운 뱃지
- 읽는중 → `ink` 아웃라인 뱃지
- 위시리스트 → `dim` 아웃라인 뱃지

## 반응형

- Tailwind `sm:` 브레이크포인트를 900px로 커스텀 (`tailwind.config.js`). 기본값 640px가 아님에 유의.
- 본문 최대 너비 1200px, `mx-auto`로 가운데 정렬 (`AppLayout.tsx`)

## 빌드 & 배포

```bash
npm test               # 프론트 단위 테스트
npm run test:rules     # 에뮬레이터로 서버 핸들러·보안 규칙 테스트
npm run build
firebase deploy --only hosting     # 프로젝트는 .firebaserc의 default 사용
firebase deploy --only functions
firebase deploy --only functions:addComment   # 바뀐 함수만 올릴 수도 있다
```

배포 뒤에는 로컬 `dist/assets/index-*.js`와 라이브 HTML이 가리키는 번들 이름이 같은지 확인한다.

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
