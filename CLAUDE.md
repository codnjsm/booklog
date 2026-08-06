# Booklog — Reading Notes App

## 프로젝트 개요
독서 기록 웹앱. React 18 + TypeScript + Vite, Firebase Hosting + Firestore + Auth.

## 기술 스택
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Firebase Hosting, Firestore, Google Auth
- **Functions**: Firebase Functions v2 (Node 20, Cloud Run, asia-northeast3) — Naver 책 검색 API 프록시
- **배포**: `npm run build && firebase deploy --only hosting --project reading-notes-6935e`
- **Functions 배포**: `firebase deploy --only functions --project reading-notes-6935e`

## Firebase 프로젝트
- Project ID: `reading-notes-6935e`
- Hosting URL: https://reading-notes-6935e.web.app

## 주요 구조
```
src/
  components/
    modals/         # AddBookModal, ManualBookModal, BookDetailModal, AddQuoteModal
  hooks/
    useAuth.ts      # Firebase Google 로그인
    useData.ts      # 로컬스토리지 + Firestore 동기화
  types.ts          # Book, Quote, AppState 타입
  App.tsx           # 메인 앱, 탭/모달 상태 관리
  index.css         # 전체 스타일 (CSS 변수 기반 다크/라이트 모드)
functions/
  src/index.ts      # Naver 책 검색 API 프록시
```

## 테마
- 기본: 다크모드 (`:root`)
- 라이트모드: `[data-theme="light"]` 속성으로 전환
- 포인트 컬러: `--success` (완독 상태 — 파란 계열, 다크 `#4FA3E0` / 라이트 `#2272C3`)

## 상태별 컬러
- 완독: `var(--success)` 블루 — 카드 보더, 뱃지, 필터 칩
- 읽는중/위시리스트: 기본 스타일 (컬러 없음)

## 책 검색
- Naver 책 검색 API → Firebase Functions 프록시 (`/api/naverBookSearch`)
- API 키는 Firebase Secret Manager에 저장

## 빌드 & 배포
```bash
npm run build
firebase deploy --only hosting --project reading-notes-6935e
```
