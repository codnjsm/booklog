import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, type AppCheck } from 'firebase/app-check'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, collection, query, where, updateDoc, deleteDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { AppState, UserProfile, FriendRequest } from './types'

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
export const db = getFirestore(app)
const functions = getFunctions(app, 'asia-northeast3')
const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export const signIn = () => signInWithPopup(auth, provider).then((r) => r.user)
export const signOutUser = () => signOut(auth)
export const onAuthChange = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb)

export const loadUserData = async (userId: string): Promise<AppState | null> => {
  const snap = await getDoc(doc(db, 'reading-notes', userId))
  return snap.exists() ? (snap.data() as AppState) : null
}

export const saveUserData = async (userId: string, data: AppState): Promise<void> => {
  await setDoc(doc(db, 'reading-notes', userId), data)
}

export const upsertUserProfile = async (uid: string, profile: { email: string; displayName: string; photoURL: string }): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { ...profile, email: profile.email.trim().toLowerCase() }, { merge: true })
}

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) } : null
}

/** 클라이언트가 users 컬렉션을 통째로 조회할 수 없도록, 이메일 검색은 서버 함수를 거친다. */
export const getUserByEmail = async (email: string): Promise<UserProfile | null> => {
  const call = httpsCallable<{ email: string }, UserProfile | null>(functions, 'findUserByEmail')
  const res = await call({ email })
  return res.data ?? null
}

export const sendFriendRequest = async (fromUid: string, toUid: string): Promise<void> => {
  const id = `${fromUid}_${toUid}`
  await setDoc(doc(db, 'friendRequests', id), { fromUid, toUid, status: 'pending', createdAt: new Date().toISOString() })
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
  return () => { unsub1(); unsub2() }
}

export const subscribeUserProfile = (uid: string, cb: (profile: UserProfile | null) => void): Unsubscribe => {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    cb(snap.exists() ? { uid: snap.id, ...(snap.data() as Omit<UserProfile, 'uid'>) } : null)
  })
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
