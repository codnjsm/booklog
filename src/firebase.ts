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
  verifyBeforeUpdateEmail,
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
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type {
  AppState,
  UserProfile,
  FriendRequest,
  FriendShelf,
  Post,
  Recommendation,
  Challenge,
  Comment,
} from './types'
import type { ServerNotification } from './lib/notifications'
// getToken은 App Check 쪽과 이름이 겹쳐서 별칭을 준다.
import { getMessaging, getToken as getMessagingToken, deleteToken, isSupported } from 'firebase/messaging'
import { tokenDocId, VAPID_PUBLIC_KEY, isPushConfigured, readSavedToken, writeSavedToken } from './lib/push'
import { readVisit, alreadySent, markSent } from './lib/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyAZtjU5A1ay8ZlWf63spiwEzHjxvZCqSUk',
  authDomain: 'reading-notes-6935e.firebaseapp.com',
  projectId: 'reading-notes-6935e',
  storageBucket: 'reading-notes-6935e.firebasestorage.app',
  messagingSenderId: '459987300237',
  appId: '1:459987300237:web:f0576b0978cca90b9457c4',
  // Google Analytics. 유입 경로를 세는 데만 쓴다 (lib/analytics.ts)
  measurementId: 'G-KS192H73HW',
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

/**
 * 이메일/비밀번호로 새 계정을 만든다. 표시 이름은 가입 시점에 같이 받지 않는 값이라 직접 설정해준다.
 * 가입하자마자 인증 메일을 보낸다 — 주소를 잘못 적었으면 메일이 안 오는 걸로 바로 알아챌 수 있고,
 * 기록이 쌓이기 전에 고칠 기회가 생긴다. 발송이 실패해도 가입 자체는 성공으로 두되,
 * 화면에서 "보냈다"고 잘못 안내하지 않도록 성공 여부를 같이 돌려준다.
 */
export const signUpWithEmail = async (
  name: string,
  email: string,
  password: string,
): Promise<{ user: User; verificationSent: boolean }> => {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  // users 문서를 여기서 같이 만든다. createUserWithEmailAndPassword가 끝나는 순간 이미 로그인
  // 상태가 되어 App의 프로필 effect가 이 문서를 읽으러 출발하는데, 그때 문서가 없고 Auth의
  // displayName도 아직 비어 있으면 이름이 "사용자"로 표시되고 빈 이름이 문서에 저장된다.
  await upsertUserProfile(cred.user.uid, { email: email.trim(), displayName: name, photoURL: '' })
  let verificationSent = true
  try {
    await sendEmailVerification(cred.user)
  } catch {
    verificationSent = false
  }
  return { user: cred.user, verificationSent }
}

/**
 * 계정의 이메일을 바꾼다. 새 주소로 인증 메일이 먼저 가고, 링크를 눌러야 실제로 교체된다.
 * 덕분에 새 주소가 진짜인지 자동으로 검증되고, 또 오타를 내면 교체가 일어나지 않아 잃는 게 없다.
 * (이메일 열거 방지가 켜져 있으면 예전 updateEmail은 막히고 이 방식만 쓸 수 있다.)
 */
export const changeEmail = (newEmail: string): Promise<void> => {
  if (!auth.currentUser) return Promise.reject(new Error('로그인이 필요합니다'))
  return verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim())
}

export const signInWithEmail = (email: string, password: string): Promise<User> =>
  signInWithEmailAndPassword(auth, email, password).then((r) => r.user)

export const sendPasswordReset = (email: string): Promise<void> => sendPasswordResetEmail(auth, email)

/**
 * 인증 메일을 다시 보낸다. 가입 직후에는 signUpWithEmail이 한 번 자동으로 보내므로,
 * 이 함수는 "메일이 안 왔어요"라고 다시 요청하는 경우와 친구 기능 진입 시 안내용으로 쓴다.
 */
export const sendVerificationEmail = (): Promise<void> => {
  if (!auth.currentUser) return Promise.reject(new Error('로그인이 필요합니다'))
  return sendEmailVerification(auth.currentUser)
}

/** Firebase Auth 에러 코드를 한국어 안내로 바꾼다. 구글 팝업과 이메일 로그인/가입 양쪽에서 쓴다. */
/**
 * 알릴 필요가 없어 토스트를 띄우지 않는 코드.
 * - popup-closed-by-user: 사용자가 직접 팝업을 닫은 것이라 본인이 이미 안다. 게다가 Firebase는
 *   팝업이 닫혔는지 폴링으로 확인해서 몇 초 늦게 알려주는데, 그 사이 이메일 로그인으로 넘어가 있으면
 *   "로그인이 취소됐어요"가 방금 입력하던 게 취소된 것처럼 읽힌다.
 * - cancelled-popup-request: 로그인 버튼을 연달아 눌러 이전 팝업 요청이 대체된 것. 오류가 아니다.
 */
const SILENT_AUTH_ERRORS = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

const AUTH_ERROR_MESSAGES: Record<string, { msg: string; type: 'info' | 'error' }> = {
  'auth/email-already-in-use': { msg: '이미 가입된 이메일이에요', type: 'error' },
  'auth/invalid-email': { msg: '이메일 형식이 올바르지 않아요', type: 'error' },
  'auth/weak-password': { msg: '비밀번호는 6자 이상이어야 해요', type: 'error' },
  'auth/wrong-password': { msg: '비밀번호가 맞지 않아요', type: 'error' },
  'auth/invalid-credential': { msg: '이메일 또는 비밀번호가 맞지 않아요', type: 'error' },
  'auth/user-not-found': { msg: '가입되지 않은 이메일이에요', type: 'error' },
  'auth/requires-recent-login': { msg: '보안을 위해 다시 로그인한 뒤 시도해주세요', type: 'error' },
  'auth/too-many-requests': { msg: '너무 많이 시도했어요. 잠시 후 다시 시도해주세요', type: 'error' },
  'auth/account-exists-with-different-credential': { msg: '이미 다른 방식으로 가입된 이메일이에요', type: 'error' },
  'auth/network-request-failed': { msg: '네트워크 연결을 확인해주세요', type: 'error' },
}

/** 보여줄 메시지. null이면 알릴 필요가 없는 에러이므로 토스트를 띄우지 않는다. */
export function authErrorMessage(err: unknown): { msg: string; type: 'info' | 'error' } | null {
  const code = (err as { code?: string } | null | undefined)?.code
  if (code && SILENT_AUTH_ERRORS.has(code)) return null
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
 * 배경: docs/decisions/260907-132332-friend-data-behind-callable.md
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

/**
 * 회원 탈퇴. 서버가 게시물·친구관계·기록·프로필·Auth 계정을 한 번에 지운다.
 * 되돌릴 수 없다. 호출 전에 화면에서 반드시 확인을 받아야 한다.
 */
/**
 * 내 알림을 실시간으로 구독한다. 서버(콜러블)만 쓰고, 보안 규칙상 본인만 읽는다.
 * 게시물과 권유는 클라이언트가 직접 못 읽으므로, "내 글에 좋아요가 달렸다"
 * "책을 권해왔다"를 알려면 이 통로가 필요하다.
 *
 * 종류(kind)를 여기서 가리지 않고 그대로 넘긴다 — 무슨 알림인지는 화면이 정한다.
 */
/** 한 번에 받아둘 알림 수. 종을 눌렀을 때 보여줄 만큼이면 충분하다. */
const NOTIFICATION_FEED_LIMIT = 50

export const subscribeNotifications = (uid: string, cb: (items: ServerNotification[]) => void): (() => void) =>
  onSnapshot(
    // 최신 것만 받는다. 알림이 쌓여도 앱을 열 때마다 읽는 양이 늘어나지 않게 상한을 둔다.
    query(collection(db, 'notifications', uid, 'items'), orderBy('createdAt', 'desc'), limit(NOTIFICATION_FEED_LIMIT)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServerNotification, 'id'>) }))),
    () => cb([]),
  )

/**
 * 읽은 알림을 서버에서 지운다. 화면에서만 가리면 문서가 영영 남는다.
 * 서버가 이 참에 묵은 알림도 같이 정리한다.
 */
export const dismissNotifications = async (ids: string[]): Promise<void> => {
  const call = httpsCallable<{ ids: string[] }, { removed: number }>(functions, 'dismissNotifications')
  await call({ ids })
}

/** 좋아요를 켜고 끈다. 서버가 바뀐 상태와 수를 돌려준다. */
export const toggleLike = async (postId: string): Promise<{ liked: boolean; count: number }> => {
  const call = httpsCallable<{ postId: string }, { liked: boolean; count: number }>(functions, 'toggleLike')
  return (await call({ postId })).data
}

/** 누른 사람 목록. 내 친구가 아닌 사람은 서버가 이름을 비워서 보낸다. */
export const getPostLikes = async (
  postId: string,
): Promise<{ displayName: string; photoURL: string; known: boolean }[]> => {
  const call = httpsCallable<{ postId: string }, { displayName: string; photoURL: string; known: boolean }[]>(
    functions,
    'getPostLikes',
  )
  return (await call({ postId })).data ?? []
}

/** 이 브라우저가 웹 푸시를 쓸 수 있는지. Notification API와 FCM 지원을 모두 본다. */
export const isPushSupported = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') return false
  try {
    return await isSupported()
  } catch {
    return false
  }
}

/** 푸시를 켠 결과. 화면이 뭘 안내할지 이걸로 정한다. */
export type EnablePushResult = 'granted' | 'denied' | 'unsupported' | 'unconfigured' | 'failed'

/**
 * 알림을 켠다. 권한을 묻고, 이 기기의 토큰을 받아 저장한다.
 *
 * 토큰 발급에는 서비스워커가 필요하다. Firebase는 기본적으로 /firebase-messaging-sw.js를
 * 찾는데, 우리는 이미 /sw.js를 쓰고 있으므로 그 등록을 직접 넘긴다.
 */
export const enablePush = async (uid: string): Promise<EnablePushResult> => {
  if (!isPushConfigured()) return 'unconfigured'
  if (typeof Notification === 'undefined' || !(await isSupported())) return 'unsupported'

  // 브라우저는 한 번 거절당하면 다시 묻지 못한다. 이미 정해진 답이 있으면 그대로 따른다.
  const permission =
    Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') return 'denied'

  try {
    const registration = await navigator.serviceWorker.ready
    const token = await getMessagingToken(getMessaging(app), {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return 'failed'
    await saveFcmToken(uid, token)
    writeSavedToken({ token, uid })
    return 'granted'
  } catch {
    // 발급에 실패해도 앱은 그대로 동작한다. 앱 내 알림함만 쓰게 된다.
    return 'failed'
  }
}

/**
 * 알림을 끈다. 이 기기 토큰만 지운다 — 다른 기기는 계속 받아야 한다.
 * 로그아웃할 때도 부른다. 안 지우면 남의 계정으로 바꿔 로그인한 기기에 옛 주인 알림이 간다.
 */
export const disablePush = async (uid: string): Promise<void> => {
  const saved = readSavedToken()
  // 문서를 먼저 지우고, 성공했을 때만 기록을 비운다.
  // 기록부터 지우면 삭제가 실패했을 때 **무슨 토큰이었는지조차 잃어** 나중에 수습할 길이 없다.
  if (saved) {
    try {
      await deleteFcmToken(uid, saved.token)
      writeSavedToken(null)
    } catch {
      /* 기록은 남겨둔다. 다음 로그인 때 reconcilePush가 수습한다 */
    }
  } else {
    writeSavedToken(null)
  }
  try {
    if (await isSupported()) await deleteToken(getMessaging(app))
  } catch {
    /* 이미 없는 토큰을 지우는 건 아무 일도 아니다 */
  }
}

/**
 * 로그인 직후, 남의 계정 앞으로 남아 있는 이 기기 주소를 무력화한다.
 *
 * 로그아웃 때 삭제가 실패하면 그 계정 문서에 이 기기 주소가 남는다. 보안 규칙상
 * 남의 문서는 지울 수 없지만, **토큰 자체를 폐기**하면 죽은 주소가 되어
 * 다음 발송 때 서버가 거둬간다. 그래야 그 계정 알림이 이 기기로 오지 않는다.
 */
export const reconcilePush = async (uid: string): Promise<void> => {
  const saved = readSavedToken()
  if (!saved || saved.uid === uid) return

  // 계정을 적기 전에 저장된 기록. 내 계정에 그 토큰이 있으면 내 것이므로 주인만 적어준다.
  // 안 그러면 푸시는 오는데 토글은 꺼짐으로 보인다.
  if (saved.uid === '') {
    if (await fcmTokenExists(uid, saved.token)) {
      writeSavedToken({ token: saved.token, uid })
      return
    }
  }

  try {
    if (await isSupported()) await deleteToken(getMessaging(app))
  } catch {
    /* 폐기에 실패해도 앱은 그대로 동작한다 */
  }
  writeSavedToken(null)
}

/**
 * 푸시를 보낼 기기 주소를 저장한다. 기기마다 하나씩 쌓인다.
 *
 * users 문서가 아니라 하위 컬렉션에 두는 이유 — users 문서는 친구가 읽을 수 있다(프로필 조회).
 * 토큰이 새 나가면 남이 그 기기로 알림을 보낼 수 있어서, 본인만 읽는 자리에 따로 둔다.
 */
export const saveFcmToken = async (uid: string, token: string): Promise<void> => {
  await setDoc(doc(db, 'users', uid, 'fcmTokens', tokenDocId(token)), {
    token,
    updatedAt: new Date().toISOString(),
  })
}

/** 이 계정에 이 토큰이 저장돼 있는지. 주인을 모르는 옛 기록을 가려낼 때 쓴다. */
export const fcmTokenExists = async (uid: string, token: string): Promise<boolean> => {
  try {
    return (await getDoc(doc(db, 'users', uid, 'fcmTokens', tokenDocId(token)))).exists()
  } catch {
    return false
  }
}

/** 이 기기 토큰만 지운다. 로그아웃하거나 알림을 끌 때 쓴다. */
export const deleteFcmToken = async (uid: string, token: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'fcmTokens', tokenDocId(token)))
}

/**
 * 친구에게 책을 권한다. 책 내용은 서버가 내 서재에서 꺼내므로 id만 보낸다.
 */
export const recommendBook = async (toUid: string, bookId: string, message: string): Promise<void> => {
  const call = httpsCallable<{ toUid: string; bookId: string; message: string }, { id: string }>(
    functions,
    'recommendBook',
  )
  await call({ toUid, bookId, message })
}

/** 나에게 온, 아직 처리하지 않은 권유 목록. */
export const getRecommendations = async (): Promise<Recommendation[]> => {
  const call = httpsCallable<void, Recommendation[]>(functions, 'getRecommendations')
  return (await call()).data ?? []
}

/**
 * 받은 권유를 수락하거나 거절한다.
 * 수락해도 **서버는 책을 넣지 않는다** — 담는 건 이쪽(useData.addBook)이다.
 */
export const respondRecommendation = async (id: string, accept: boolean): Promise<void> => {
  const call = httpsCallable<{ id: string; accept: boolean }, { ok: true }>(functions, 'respondRecommendation')
  await call({ id, accept })
}

/* ─────────────── 댓글 ─────────────── */

/** 댓글을 단다. 게시물이 서버 전용이라 콜러블을 거친다. */
export const addComment = async (postId: string, text: string): Promise<void> => {
  await httpsCallable<{ postId: string; text: string }, { id: string }>(functions, 'addComment')({ postId, text })
}

/** 쓴 사람과 글쓴이가 지울 수 있다. 권한 판단은 서버가 한다. */
export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
  await httpsCallable<{ postId: string; commentId: string }, { ok: true }>(
    functions,
    'deleteComment',
  )({ postId, commentId })
}

/** 펼쳤을 때만 부른다. 피드 응답에는 댓글 수만 들어 있다. */
export const getComments = async (postId: string): Promise<Comment[]> => {
  const call = httpsCallable<{ postId: string }, Comment[]>(functions, 'getComments')
  return (await call({ postId })).data ?? []
}

/* ─────────────── 독서 챌린지 ─────────────── */

/** 참여 중인 것과 초대받은 것. 날짜 수는 서버가 세어서 온다. */
export const listChallenges = async (): Promise<{ joined: Challenge[]; invited: Challenge[] }> => {
  const call = httpsCallable<void, { joined: Challenge[]; invited: Challenge[] }>(functions, 'listChallenges')
  return (await call()).data ?? { joined: [], invited: [] }
}

export const createChallenge = async (data: {
  from: string
  to: string
  goalDays: number
  invite: string[]
}): Promise<string> => {
  const call = httpsCallable<typeof data, { id: string }>(functions, 'createChallenge')
  return (await call(data)).data.id
}

export const joinChallenge = async (challengeId: string): Promise<void> => {
  await httpsCallable<{ challengeId: string }, { ok: true }>(functions, 'joinChallenge')({ challengeId })
}

export const declineChallenge = async (challengeId: string): Promise<void> => {
  await httpsCallable<{ challengeId: string }, { ok: true }>(functions, 'declineChallenge')({ challengeId })
}

export const deleteChallenge = async (challengeId: string): Promise<void> => {
  await httpsCallable<{ challengeId: string }, { ok: true }>(functions, 'deleteChallenge')({ challengeId })
}

export const deleteAccount = async (): Promise<void> => {
  const call = httpsCallable<void, { ok: true }>(functions, 'deleteAccount')
  await call()
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

/**
 * 프로필 사진만 바꾼다. 이미지는 Firebase Auth가 아니라 이 문서에 담는다 —
 * Auth의 photoURL은 짧은 URL을 담는 자리라 데이터 URI를 넣기에 적절하지 않고,
 * 친구 목록·피드가 이미 이 문서를 읽고 있어 여기 두면 그대로 반영된다.
 * 빈 문자열을 넣으면 사진을 지운 것으로 보고 글자 아바타로 돌아간다.
 */
export const updateUserPhoto = async (uid: string, photoURL: string): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { photoURL }, { merge: true })
}

/**
 * 표시 이름만 바꾼다. 사진과 같은 이유로 Auth가 아니라 이 문서를 기준으로 삼는다 —
 * Google 계정은 로그인할 때마다 Auth 프로필이 Google 값으로 덮일 수 있어서,
 * 사용자가 직접 정한 이름은 우리 문서에 두는 쪽이 확실하다.
 */
export const updateUserName = async (uid: string, displayName: string): Promise<void> => {
  await setDoc(doc(db, 'users', uid), { displayName }, { merge: true })
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

/**
 * 유입 측정을 시작한다. 한 방문에 한 번만 보낸다.
 *
 * 실패해도 앱은 그대로 돈다 — 광고 차단기나 인앱 브라우저에서 막히는 일이 흔하고,
 * 그건 통계가 조금 비는 문제지 사용자가 겪을 문제가 아니다.
 */
export const startAnalytics = async (search: string): Promise<void> => {
  try {
    if (alreadySent()) return
    const { getAnalytics, isSupported: analyticsSupported, logEvent } = await import('firebase/analytics')
    if (!(await analyticsSupported())) return

    const visit = readVisit(search)
    // GA4가 자동으로 세는 page_view와 별개로, 우리가 붙인 꼬리표를 그대로 남긴다.
    // 자동 집계는 하루쯤 걸리지만 이 이벤트는 실시간 보고서에서 바로 보인다.
    logEvent(getAnalytics(app), 'visit', visit)
    markSent()
  } catch {
    /* 측정이 안 되는 건 앱이 안 되는 것과 다르다 */
  }
}
