# Booklog

독서 기록 웹앱. 읽은 책과 인상 깊은 문장을 기록하고, 친구와 책장을 공유합니다.

**https://reading-notes-6935e.web.app**

## 주요 기능

- **홈** — 오늘의 독서 목표 진행률, 지금 읽는 중인 책, 오늘의 문장, 최근 활동 피드
- **서재** — 위시리스트 / 읽는중 / 완독 상태로 책 관리, 별점·독후감·비공개 설정(친구에게 숨기기)
- **모음** — 책에서 발췌한 인용구(형광펜으로 부분 강조 가능) + 우리말샘 사전 검색·단어장을 한 화면에서, 책 페이지 사진으로 문장 인식(OCR)해 인용구로 가져오기
- **기록** — 완독 달력, 최근 12개월 완독 추이, 연간 독서 목표
- **친구** — 이메일로 친구 추가, 서로의 책장 열람(비공개 책 제외), 문장·책을 친구 피드에 공유, 피드 글에 **좋아요·댓글**, 친구에게 **책 권하기**, 기간을 정해 함께 기록하는 **독서 챌린지**
- **알림** — 친구 요청·수락, 좋아요·댓글, 받은 추천, 챌린지 소식을 알림함에 모아서 확인
- **웹 푸시** — 홈 화면에 추가하면 앱을 열지 않아도 알림 수신 (iOS는 홈 화면 추가가 필수, 안드로이드·PC는 브라우저에서 바로 가능)
- 로그인 없이도 브라우저 로컬 저장으로 사용 가능. Google·이메일 로그인 시 기기 간 동기화
- 이메일 인증·변경, 회원 탈퇴(남긴 글·댓글·알림까지 정리)
- 다크/라이트 테마, 데스크톱 사이드바 / 모바일 하단 탭 네비게이션
- 더보기에서 문의하기, 개인정보처리방침·이용약관 열람

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **상태 관리**: React Context(전역 UI 상태) + `@tanstack/react-query`(서버 상태) + `react-router-dom`(URL 상태)
- **Backend**: Firebase Hosting, Firestore, Google·이메일 Auth, Cloud Messaging(웹 푸시)
- **Functions**: Firebase Functions v2 (Node 22, asia-northeast3) — 외부 API 프록시 2개 + 콜러블 24개

## 시작하기

```bash
npm install
npm run dev
```

`http://localhost:5173`에서 확인. Firebase 클라이언트 설정은 `src/firebase.ts`에 포함되어 있어 별도 `.env` 없이 바로 실행됩니다. 다만 책 검색·사전 검색·문장 인식과 친구 기능 전반은 Firebase Functions를 거치므로, 로컬 개발 서버만으로는 동작하지 않습니다(배포 환경에서만 정상 동작).

## 테스트

```bash
npm test          # 프론트 단위 테스트 (vitest)
npm run test:rules # Firestore 에뮬레이터 + 서버 핸들러 테스트
```

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
    modals/            # 책 추가·상세·수동 입력, 문장·단어 추가, 친구 추가, 공유,
                       # 책 권하기, 챌린지 만들기, 좋아요 목록, 로그인, 탈퇴, 환영 등
    HomeTab, BooksTab, CollectionTab, RecordsTab, FriendsTab, MoreTab
    QuotesTab, WordsTab, StatsTab, CalendarTab   # CollectionTab/RecordsTab 안에서 조합
    ChallengeSection   # 친구 탭의 독서 챌린지 칸
    NotificationBell, PostCard, PostLikes, PostComments, BookCard, QuoteCard,
    HighlightedText, DatePicker, DateMultiPicker, Toast, TodayRecommendation
  contexts/
    AppUIContext.tsx  # 탭(URL 라우팅)/모달/테마/토스트 등 전역 UI 상태
  hooks/
    useAuth.ts        # Google·이메일 로그인
    useData.ts        # 로컬스토리지 + Firestore 동기화, 책/인용구/단어 CRUD
    useFriends.ts     # 친구 요청 구독, 친구 책장·피드, 책 권하기
    usePush.ts        # 알림 권한·기기 등록 상태
  lib/
    insights.ts        # 홈 대시보드용 파생 지표(목표 페이스, 최근 활동 등)
    day.ts             # 날짜 기준 — 저장은 UTC, 표시는 기기 지역시간
    notifications.ts   # 알림 목록 구성과 읽음·지움 처리
    analytics.ts       # 유입 경로(utm) 측정
    push.ts            # 웹 푸시 설정 상태 판단
    install.ts         # 홈 화면 추가 안내 판단
    serviceWorker.ts   # 서비스워커 등록과 탈출구
    recommend.ts       # 읽은 책 기반 추천
    browser.ts         # 로컬 저장이 지워질 수 있는 브라우저 판별(ITP)
    image.ts           # 사진 리사이즈
  firebase.ts          # Firebase 초기화 + Firestore 접근 함수
  types.ts             # Book, Quote, Word, AppState, Post, Challenge 등 타입
public/
  sw.js                # 푸시 수신 서비스워커
  privacy.html         # 개인정보처리방침 (앱 번들 밖의 정적 페이지)
  terms.html           # 이용약관
functions/
  src/index.ts         # 책 검색·사전 프록시, 친구/피드/좋아요/댓글, 책 권하기,
                       # 독서 챌린지, 알림·푸시 발송, 문장 인식(OCR), 회원 탈퇴
firestore.rules         # Firestore 보안 규칙
tests/                  # 에뮬레이터로 도는 서버 핸들러·보안 규칙 테스트
```

## 문서

| 문서 | 내용 |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | 아키텍처, 데이터 저장 구조, 날짜·색 규칙 등 작업할 때 먼저 볼 것 |
| [BOOKLOG_PHASE2.md](BOOKLOG_PHASE2.md) | 친구 기능 단계별 설계와 Phase 2 결산 |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | 용어 정의 |
| [docs/decisions/](docs/decisions/) | 되돌리기 어려운 결정의 배경 |

이용자용 문서는 서비스에서 바로 열립니다 — [개인정보처리방침](https://reading-notes-6935e.web.app/privacy.html) · [이용약관](https://reading-notes-6935e.web.app/terms.html)
