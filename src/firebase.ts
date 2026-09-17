import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, type AppCheck } from 'firebase/app-check'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { AppState, UserProfile, FriendRequest, FriendShelf, Post } from './types'

const firebaseConfig = {
  apiKey: 'AIzaSyAZtjU5A1ay8ZlWf63spiwEzHjxvZCqSUk',
  authDomain: 'reading-notes-6935e.firebaseapp.com',
  projectId: 'reading-notes-6935e',
  storageBucket: 'reading-notes-6935e.firebasestorage.app',
  messagingSenderId: '459987300237',
  appId: '1:459987300237:web:f0576b0978cca90b9457c4',
}

// reCAPTCHA Enterprise 사이트 키. Firebase Console > App Check 에 등록된 키와 같아야 한다.
// 사이트 키는 클라이언트에 노출되는 공개 값이고, 실제 보호는 GCP 쪽 도메인 확인이 담당한다.
// 주의: 이 키가 배포된 뒤에만 Console에서 Firestore/Functions enforcement를 켤 것.
// 순서가 바뀌면(배포 전에 enforcement부터 켜면) 토큰 없는 사용자 요청이 전부 막힌다.
const RECAPTCHA_SITE_KEY = '6LcNgqgtAAAAAOvUYZcS7lWnykuvGghuK3jauwQO'

const app = initializeApp(firebaseConfig)
let appCheck: AppCheck | undefined
if (RECAPTCHA_SITE_KEY) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}
export const auth = getAuth(app)
// 인증 메일·비밀번호 재설정 메일이 Firebase의 한국어 기본 템플릿으로 나가게 한다.
auth.languageCode = 'ko'
export const db = getFirestore(app)
const functions = getFunctions(app, 'asia-northeast3')
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export const signIn = () => signInWithPopup(auth, provider).then((r) => r.user)
export const signOutUser = () => signOut(auth)
export const onAuthChange = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb)

/** 이메일/비밀번호로 새 계정을 만든다. 표시 이름은 가입 시점에 같이 받지 않는 값이라 직접 설정해준다. */
export const signUpWithEmail = async (name: string, email: string, password: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  return cred.user
}

export const signInWithEmail = (email: string, password: string): Promise<User> =>
  signInWithEmailAndPassword(auth, email, password).then((r) => r.user)

export const sendPasswordReset = (email: string): Promise<void> => sendPasswordResetEmail(auth, email)

/**
 * 친구 기능(검색·추가)을 쓰기 전에 이메일 인증을 받는다. 가입 직후 자동으로 보내지 않고
 * 사용자가 직접 요청할 때만 보낸다 — 예상 못 한 메일은 발신 도메인이 낯설어 피싱으로 오인되기 쉽다.
 */
export const sendVerificationEmail = (): Promise<void> => {
  if (!auth.currentUser) return Promise.reject(new Error('로그인이 필요합니다'))
  return sendEmailVerification(auth.currentUser)
}

/** Firebase Auth 에러 코드를 한국어 안내로 바꾼다. 구글 팝업과 이메일 로그인/가입 양쪽에서 쓴다. */
const AUTH_ERROR_MESSAGES: Record<string, { msg: string; type: 'info' | 'error' }> = {
  'auth/popup-closed-by-user': { msg: '로그인이 취소됐어요', type: 'info' },
  'auth/email-already-in-use': { msg: '이미 가입된 이메일이에요', type: 'error' },
  'auth/invalid-email': { msg: '이메일 형식이 올바르지 않아요', type: 'error' },
  'auth/weak-password': { msg: '비밀번호는 6자 이상이어야 해요', type: 'error' },
  'auth/wrong-password': { msg: '비밀번호가 맞지 않아요', type: 'error' },
  'auth/invalid-credential': { msg: '이메일 또는 비밀번호가 맞지 않아요', type: 'error' },
  'auth/user-not-found': { msg: '가입되지 않은 이메일이에요', type: 'error' },
  'auth/too-many-requests': { msg: '너무 많이 시도했어요. 잠시 후 다시 시도해주세요', type: 'error' },
  'auth/account-exists-with-different-credential': { msg: '이미 다른 방식으로 가입된 이메일이에요', type: 'error' },
  'auth/network-request-failed': { msg: '네트워크 연결을 확인해주세요', type: 'error' },
}

export function authErrorMessage(err: unknown): { msg: string; type: 'info' | 'error' } {
  const code = (err as { code?: string } | null | undefined)?.code
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code]
  return { msg: '오류가 발생했어요. 다시 시도해주세요', type: 'error' }
}

export const loadUserData = async (userId: string): Promise<AppState | null> => {
  const snap = await getDoc(doc(db, 'reading-notes', userId))
  return snap.exists() ? (snap.data() as AppState) : null
}

export const saveUserData = async (userId: string, data: AppState): Promise<void> => {
  await setDoc(doc(db, 'reading-notes', userId), data)
}

/**
 * 친구 책장. 보안 규칙은 남의 reading-notes 문서를 직접 못 읽게 막아두었고,
 * 공개해도 되는 범위만 서버가 골라서 돌려준다.
 * 배경: .forge/adr/260907-132332-friend-data-behind-callable.md
 */
export const getFriendShelf = async (uid: string): Promise<FriendShelf> => {
  const call = httpsCallable<{ uid: string }, FriendShelf>(functions, 'getFriendShelf')
  const res = await call({ uid })
  return res.data
}

/** 본인 + 친구들의 게시물을 최신순으로 가져온다. 서버(getFriendFeed)가 작성자 표시정보를 동봉한다. */
export const getFriendFeed = async (): Promise<Post[]> => {
  const call = httpsCallable<void, Post[]>(functions, 'getFriendFeed')
  const res = await call()
  return res.data
}

/** 발행 직후 화면에 바로 이어붙일 수 있도록, 서버가 저장한 내용을 그대로 돌려받는다(작성자 표시정보 제외). */
export type CreatedPost = Omit<Post, 'authorDisplayName' | 'authorPhotoURL'>

/** 문장(quote) 또는 책(book) 하나를 골라 한마디를 붙여 친구에게 공유한다. 스냅샷은 서버가 만든다. */
export const createPost = async (data: {
  kind: 'quote' | 'book'
  refId: string
  caption: string
}): Promise<CreatedPost> => {
  const call = httpsCallable<typeof data, CreatedPost>(functions, 'createPost')
  const res = await call(data)
  return res.data
}

/** 본인 게시물만 지울 수 있다 — 서버가 작성자를 확인한다. */
export const deletePost = async (postId: string): Promise<void> => {
  const call = httpsCallable<{ postId: string }, { ok: true }>(functions, 'deletePost')
  await call({ postId })
}

/** 책 페이지 사진에서 텍스트를 인식한다(OCR). base64Image는 데이터 URI 접두어 없는 순수 base64. */
export const ocrBookPage = async (base64Image: string): Promise<string> => {
  const call = httpsCallable<{ base64Image: string }, string>(functions, 'ocrBookPage')
  const res = await call({ base64Image })
  return res.data
}

export const upsertUserProfile = async (
  uid: string,
  profile: { email: string; displayName: string; photoURL: string },
): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { ...profile, email: profile.email.trim().toLowerCase() }, { merge: true })
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) } : null
}

/** 클라이언트가 users 컬렉션을 통째로 조회할 수 없도록, 이메일 검색은 서버 함수를 거친다. */
/** 이메일 앞부분으로 회원을 검색한다. 서버가 최소 글자 수(4자)와 결과 수를 제한한다. */
export const searchUsersByEmail = async (email: string): Promise<UserProfile[]> => {
  const call = httpsCallable<{ email: string }, UserProfile[]>(functions, 'findUserByEmail')
  const res = await call({ email })
  return res.data ?? []
}

export const sendFriendRequest = async (fromUid: string, toUid: string): Promise<void> => {
  const id = `${fromUid}_${toUid}`
  await setDoc(doc(db, 'friendRequests', id), {
    fromUid,
    toUid,
    status: 'pending',
    createdAt: new Date().toISOString(),
  })
}

export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' })
}

export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' })
}

export const deleteFriendRequest = async (requestId: string): Promise<void> => {
  await deleteDoc(doc(db, 'friendRequests', requestId))
}

export const subscribeFriendRequests = (
  uid: string,
  onIncoming: (reqs: FriendRequest[]) => void,
  onOutgoing: (reqs: FriendRequest[]) => void,
): Unsubscribe => {
  const unsub1 = onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', uid)), (snap) => {
    onIncoming(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) })))
  })
  const unsub2 = onSnapshot(query(collection(db, 'friendRequests'), where('fromUid', '==', uid)), (snap) => {
    onOutgoing(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) })))
  })
  return () => {
    unsub1()
    unsub2()
  }
}

export const subscribeUserProfile = (uid: string, cb: (profile: UserProfile | null) => void): Unsubscribe => {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    cb(snap.exists() ? { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) } : null)
  })
}

/**
 * Functions 호출 실패 시 사용자에게 보여줄 메시지를 고른다.
 * 우리 서버 코드가 던진 HttpsError는 항상 한국어 메시지라 그대로 보여줘도 되지만,
 * App Check 검증 실패 같은 플랫폼 레벨 거부는 "Service Unavailable"처럼 영어 원문이 그대로 온다.
 * 한글이 섞여 있으면 우리가 의도한 메시지로 보고, 아니면 안내 문구로 대체한다.
 */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && /[가-힣]/.test(err.message)) return err.message
  return fallback
}

/**
 * 카카오/사전 검색 프록시는 Firestore와 달리 Firebase SDK를 안 거치는 일반 fetch라
 * App Check 토큰이 자동으로 안 실린다. 여기서 직접 헤더에 넣어준다.
 */
export async function fetchWithAppCheck(url: string): Promise<Response> {
  const headers: Record<string, string> = {}
  if (appCheck) {
    try {
      const { token } = await getToken(appCheck, false)
      headers['X-Firebase-AppCheck'] = token
    } catch {
      // 토큰 발급 실패해도 요청은 보낸다. 서버가 verifyToken 실패로 거부할지 판단한다.
    }
  }
  return fetch(url, { headers })
}
