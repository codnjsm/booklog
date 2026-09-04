import { initializeApp } from 'firebase/app'
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

const app = initializeApp(firebaseConfig)
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
