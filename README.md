# Booklog

독서 기록 웹앱. 읽은 책과 인상 깊은 문장을 기록하고, 친구와 책장을 공유합니다.

**https://reading-notes-6935e.web.app**

## 주요 기능

- **책장** — 위시리스트 / 읽는중 / 완독 상태로 책 관리, 별점·독후감·비공개 설정
- **인용구** — 책에서 발췌한 문장 저장, 태그로 분류
- **사전** — 우리말샘 사전 검색 후 단어장에 저장
- **달력** — 읽은 기간을 월별 캘린더로 확인
- **통계** — 완독 수, 평균 별점, 최근 12개월 추이, 연간 독서 목표
- **친구** — 이메일로 친구 추가, 서로의 책장 열람(비공개 책 제외)
- Google 로그인 시 기기 간 동기화, 로그인 없이도 브라우저 로컬 저장으로 사용 가능
- 다크/라이트 테마

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
  components/       # 탭별 컴포넌트, 모달(components/modals/)
  contexts/          # AppUIContext — 탭/모달/테마/토스트 등 전역 UI 상태
  hooks/             # useAuth, useData(Firestore 동기화), useFriends
  firebase.ts        # Firebase 초기화 + Firestore 접근 함수
  types.ts           # Book, Quote, Word, AppState 등 타입
functions/
  src/index.ts       # kakaoBookSearch, koreanDictSearch
firestore.rules       # Firestore 보안 규칙
```

더 자세한 아키텍처 설명은 [CLAUDE.md](CLAUDE.md) 참고.
