import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAppCheck } from 'firebase-admin/app-check'
import { getAuth } from 'firebase-admin/auth'
import { getMessaging } from 'firebase-admin/messaging'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'
import type { Request, Response } from 'express'

initializeApp()

/** 테스트가 handler와 같은 firebase-admin 인스턴스(같은 기본 앱)를 쓰기 위한 통로. */
export function getDb() {
  return getFirestore()
}

const kakaoRestApiKey = defineSecret('KAKAO_REST_API_KEY')
const opendictApiKey = defineSecret('OPENDICT_API_KEY')

/**
 * onRequest(HTTP) 함수는 onCall과 달리 App Check를 자동으로 검사해주지 않는다.
 * 클라이언트가 fetchWithAppCheck()로 실어 보낸 X-Firebase-AppCheck 헤더를 직접 검증한다.
 * 검증 실패 시 true를 리턴하며 이미 401 응답까지 보낸 상태다(호출부에서 return만 하면 됨).
 */
async function rejectWithoutAppCheck(req: Request, res: Response): Promise<boolean> {
  const token = req.header('X-Firebase-AppCheck')
  if (!token) {
    res.status(401).json({ error: 'App Check token missing' })
    return true
  }
  try {
    await getAppCheck().verifyToken(token)
    return false
  } catch {
    res.status(401).json({ error: 'App Check token invalid' })
    return true
  }
}

export const kakaoBookSearch = onRequest(
  { cors: true, secrets: [kakaoRestApiKey], region: 'asia-northeast3', invoker: 'public' },
  async (req, res) => {
    if (await rejectWithoutAppCheck(req, res)) return

    const query = req.query.query as string
    if (!query) {
      res.status(400).json({ error: 'query required' })
      return
    }
    // target은 카카오가 정한 값만 허용된다. 그대로 흘려보내면 임의 값이 API로 나가므로 화이트리스트로 막는다.
    // 책 추천이 저자로 검색하려고 target=person을 쓴다(제목·출판사까지 섞이면 엉뚱한 책이 딸려온다).
    const ALLOWED_TARGETS = ['title', 'isbn', 'publisher', 'person']
    const target = req.query.target as string | undefined
    const targetParam = target && ALLOWED_TARGETS.includes(target) ? `&target=${target}` : ''
    const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&size=15${targetParam}`
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${kakaoRestApiKey.value()}`,
      },
    })
    const data = await response.json()
    res.json(data)
  },
)

export const koreanDictSearch = onRequest(
  { cors: true, secrets: [opendictApiKey], region: 'asia-northeast3', invoker: 'public' },
  async (req, res) => {
    if (await rejectWithoutAppCheck(req, res)) return

    const query = req.query.query as string
    if (!query) {
      res.status(400).json({ error: 'query required' })
      return
    }
    const url = `https://opendict.korean.go.kr/api/search?key=${opendictApiKey.value()}&q=${encodeURIComponent(query)}&req_type=json&part=word&num=20`
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  },
)

/** 이 글자 수 아래로는 검색하지 않는다 — 짧은 문자열을 훑어서 회원 목록을 긁어가는 걸 막는 방어선. */
const MIN_EMAIL_SEARCH_LENGTH = 4
const MAX_EMAIL_SEARCH_RESULTS = 10

/**
 * 이메일 접두사로 회원을 검색한다.
 *
 * Firestore는 부분 문자열 검색을 못 하므로 범위 쿼리로 접두사만 매칭한다
 * (codn → codnjsm@... 은 찾히지만, njsm 으로는 못 찾는다).
 * 전체 회원 열거를 막으려고 최소 글자 수를 두고, 결과 수도 제한한다.
 */
export async function findUserByEmailHandler(viewerUid: string, rawEmail: unknown) {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase()
  if (!email) {
    throw new HttpsError('invalid-argument', '이메일이 필요합니다')
  }
  if (email.length < MIN_EMAIL_SEARCH_LENGTH) {
    throw new HttpsError('invalid-argument', `${MIN_EMAIL_SEARCH_LENGTH}자 이상 입력해주세요`)
  }

  // \uf8ff는 유니코드에서 아주 큰 값이라, 접두사로 시작하는 문자열의 상한 역할을 한다
  const snap = await getFirestore()
    .collection('users')
    .where('email', '>=', email)
    .where('email', '<=', email + '\uf8ff')
    .limit(MAX_EMAIL_SEARCH_RESULTS + 1)
    .get()

  return snap.docs
    .filter((doc) => doc.id !== viewerUid)
    .slice(0, MAX_EMAIL_SEARCH_RESULTS)
    .map((doc) => {
      const data = doc.data()
      return {
        uid: doc.id,
        email: data.email ?? '',
        displayName: data.displayName ?? '',
        photoURL: data.photoURL ?? '',
      }
    })
}

export const findUserByEmail = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  // 남의 이메일로 가입해 놓고 회원 검색으로 신원을 확인해가며 접근하는 걸 막는다.
  // 친구 요청 생성(firestore.rules)에도 같은 조건이 있다.
  if (!req.auth.token.email_verified) {
    throw new HttpsError('permission-denied', '이메일 인증 후 이용할 수 있어요')
  }
  return findUserByEmailHandler(req.auth.uid, req.data?.email)
})

/**
 * 친구의 책장을 가져온다.
 *
 * 보안 규칙은 문서 단위로만 읽기를 제어할 수 있어서, reading-notes 문서를 친구에게
 * 열어주면 비공개 책과 인용구·독후감까지 함께 나간다. 그래서 규칙에서는 본인만 읽게
 * 막아두고, 공개해도 되는 범위를 여기서 서버가 골라 반환한다.
 * 배경: .forge/adr/260907-132332-friend-data-behind-callable.md
 *
 * 공개 범위: 공개 책(isPrivate이 아닌 책)의 id·title·author·cover·status·rating·
 * startedAt·finishedAt, 그리고 readingGoal. 독후감(review)과 인용구·단어는 내보내지 않는다.
 */
export const getFriendShelf = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  const viewerUid = req.auth.uid
  const targetUid = String(req.data?.uid ?? '').trim()
  if (!targetUid) {
    throw new HttpsError('invalid-argument', '대상 uid가 필요합니다')
  }
  if (targetUid === viewerUid) {
    throw new HttpsError('invalid-argument', '자기 자신은 친구 책장으로 열 수 없습니다')
  }

  // 수락된 친구인지 서버에서 확인한다. 문서 ID가 {fromUid}_{toUid}라 양방향 모두 본다.
  const db = getFirestore()
  const [a, b] = await Promise.all([
    db.collection('friendRequests').doc(`${viewerUid}_${targetUid}`).get(),
    db.collection('friendRequests').doc(`${targetUid}_${viewerUid}`).get(),
  ])
  const isFriend = [a, b].some((d) => d.exists && d.data()?.status === 'accepted')
  if (!isFriend) {
    throw new HttpsError('permission-denied', '친구가 아닙니다')
  }

  const snap = await db.collection('reading-notes').doc(targetUid).get()
  if (!snap.exists) return { books: [], readingGoal: 0 }

  const data = snap.data() ?? {}
  const books = Array.isArray(data.books) ? data.books : []

  return {
    books: books
      .filter((b: Record<string, unknown>) => !b.isPrivate)
      .map((b: Record<string, unknown>) => ({
        id: b.id ?? '',
        title: b.title ?? '',
        author: b.author ?? '',
        cover: b.cover ?? '',
        status: b.status ?? 'wishlist',
        rating: b.rating ?? 0,
        startedAt: b.startedAt ?? null,
        finishedAt: b.finishedAt ?? null,
      })),
    readingGoal: data.readingGoal ?? 0,
  }
})

/**
 * createPost의 실제 로직. onCall 래퍼가 인증만 확인하고 이 함수를 부른다.
 * 이렇게 분리해두면 App Check/Auth 에뮬레이터 없이 firebase-admin으로 Firestore
 * 에뮬레이터에 연결해 이 함수를 직접 테스트할 수 있다.
 *
 * 클라이언트는 {kind, refId, caption}만 보낸다 — 스냅샷에 정확히 뭐가 들어가는지는
 * 여기서 서버가 정한다. 배경: .forge/adr/260907-144119-post-snapshot-server-only-write.md
 */
export async function createPostHandler(
  uid: string,
  data: { kind?: unknown; refId?: unknown; caption?: unknown },
): Promise<Record<string, unknown>> {
  const kind = data?.kind
  if (kind !== 'quote' && kind !== 'book') {
    throw new HttpsError('invalid-argument', 'kind는 quote 또는 book이어야 합니다')
  }
  const refId = String(data?.refId ?? '').trim()
  if (!refId) {
    throw new HttpsError('invalid-argument', 'refId가 필요합니다')
  }
  const caption = String(data?.caption ?? '').trim()
  if (!caption || caption.length > 300) {
    throw new HttpsError('invalid-argument', '한마디는 1~300자여야 합니다')
  }

  const db = getFirestore()
  const notesSnap = await db.collection('reading-notes').doc(uid).get()
  const notes = notesSnap.data() ?? {}
  const books: Record<string, unknown>[] = Array.isArray(notes.books) ? notes.books : []
  const quotes: Record<string, unknown>[] = Array.isArray(notes.quotes) ? notes.quotes : []

  let attachment: Record<string, unknown>

  if (kind === 'book') {
    const book = books.find((b) => b.id === refId)
    if (!book) {
      throw new HttpsError('invalid-argument', '책을 찾을 수 없습니다')
    }
    if (book.isPrivate) {
      throw new HttpsError('invalid-argument', '비공개 책은 발행할 수 없습니다')
    }
    attachment = {
      kind: 'book',
      bookTitle: book.title ?? '',
      bookAuthor: book.author ?? '',
      bookCover: book.cover ?? '',
      bookStatus: book.status ?? 'wishlist',
      bookRating: book.rating ?? 0,
    }
  } else {
    const quote = quotes.find((q) => q.id === refId)
    if (!quote) {
      throw new HttpsError('invalid-argument', '인용구를 찾을 수 없습니다')
    }
    const linkedBook = quote.bookId ? books.find((b) => b.id === quote.bookId) : undefined
    if (linkedBook?.isPrivate) {
      throw new HttpsError('invalid-argument', '비공개 책의 인용구는 발행할 수 없습니다')
    }
    attachment = {
      kind: 'quote',
      quoteText: quote.text ?? '',
      quoteHighlights: quote.highlights ?? null,
      bookTitle: linkedBook?.title ?? null,
      bookAuthor: linkedBook?.author ?? null,
    }
  }

  // 클라이언트가 발행 직후 서버 응답만으로 피드에 바로 이어붙일 수 있도록,
  // 저장한 내용을 id와 함께 그대로 돌려준다 (재조회 왕복을 없애기 위함).
  const createdAt = new Date().toISOString()
  const doc = await db.collection('posts').add({
    authorUid: uid,
    createdAt,
    caption,
    attachment,
  })
  return { id: doc.id, authorUid: uid, createdAt, caption, attachment }
}

export const createPost = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return createPostHandler(req.auth.uid, req.data)
})

/**
 * getFriendFeed의 실제 로직. 본인 글 + 수락된 친구들의 글을 최신순으로 모은다.
 * 각 글에 작성자 표시정보(displayName/photoURL)를 동봉해 클라이언트가 추가 조회 없이
 * 렌더링할 수 있게 한다.
 *
 * Firestore 'in' 쿼리는 최대 30개까지만 지원한다. 지금 친구 수 규모에서는 문제 없고,
 * 넘는 경우의 처리는 이번 범위 밖이다.
 */
/** 피드에 한 번에 내려주는 게시물 수. Firestore 쿼리에서 바로 잘라 읽기 요금을 이만큼으로 묶는다. */
const FEED_LIMIT = 50

export async function getFriendFeedHandler(uid: string): Promise<Record<string, unknown>[]> {
  const db = getFirestore()

  const [outgoing, incoming] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', uid).where('status', '==', 'accepted').get(),
    db.collection('friendRequests').where('toUid', '==', uid).where('status', '==', 'accepted').get(),
  ])
  const friendUids = new Set<string>()
  outgoing.docs.forEach((d) => friendUids.add(d.data().toUid))
  incoming.docs.forEach((d) => friendUids.add(d.data().fromUid))
  const authorUids = [uid, ...friendUids].slice(0, 30)

  // 정렬과 개수 제한을 서버(Firestore)에 맡긴다. 예전에는 친구들의 게시물을 전부 읽어와
  // 메모리에서 정렬한 뒤 50개만 썼는데, 그러면 게시물이 쌓일수록 읽기 요금과 응답 시간이
  // 같이 늘어난다. createdAt은 createPost가 항상 넣으므로 orderBy에서 빠지는 문서는 없다.
  const postsSnap = await db
    .collection('posts')
    .where('authorUid', 'in', authorUids)
    .orderBy('createdAt', 'desc')
    .limit(FEED_LIMIT)
    .get()
  const top = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)

  const uniqueAuthors = [...new Set(top.map((p) => p.authorUid as string))]
  const profileDocs = await Promise.all(uniqueAuthors.map((u) => db.collection('users').doc(u).get()))
  const profiles = new Map(profileDocs.map((d) => [d.id, d.data()]))

  // likes(누른 사람 uid 목록)를 그대로 내려보내면 내 친구가 아닌 사람의 uid까지 넘어간다.
  // 화면에 필요한 건 수와 "내가 눌렀는지"뿐이므로 그 둘로만 줄여서 보낸다.
  // 누가 눌렀는지는 사용자가 수를 눌렀을 때 getPostLikes가 이름을 가려서 따로 준다.
  return top.map((p) => {
    const { likes, ...rest } = p as Record<string, unknown> & { likes?: unknown }
    const list: string[] = Array.isArray(likes) ? likes : []
    return {
      ...rest,
      authorDisplayName: profiles.get(p.authorUid as string)?.displayName ?? '',
      authorPhotoURL: profiles.get(p.authorUid as string)?.photoURL ?? '',
      likeCount: list.length,
      likedByMe: list.includes(uid),
    }
  })
}

export const getFriendFeed = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return getFriendFeedHandler(req.auth.uid)
})

/**
 * deletePost의 실제 로직. 작성자 본인만 지울 수 있다.
 * 남의 게시물을 지울 수 있으면 안 된다 — 이게 이번 발행 기능에서 가장 중요하게
 * 지켜야 할 지점이다.
 */
/** 수락된 친구인지 확인한다. 문서 ID가 {fromUid}_{toUid}라 양방향 모두 본다. */
async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return true
  const db = getDb()
  const [x, y] = await Promise.all([
    db.collection('friendRequests').doc(`${a}_${b}`).get(),
    db.collection('friendRequests').doc(`${b}_${a}`).get(),
  ])
  return [x, y].some((d) => d.exists && d.data()?.status === 'accepted')
}

/**
 * 좋아요를 켜고 끈다.
 *
 * 게시물은 클라이언트가 직접 못 읽고 못 쓰므로(firestore.rules) 여기를 거친다.
 * 누른 사람 목록은 게시물 안에 둔다 — 친구 수가 많지 않아 길어질 일이 없고,
 * "내가 눌렀는지"를 따로 조회하지 않아도 된다.
 * 동시에 눌러도 서로 덮어쓰지 않도록 배열 전체가 아니라 원소 단위로 더하고 뺀다.
 */
export async function toggleLikeHandler(uid: string, postId: unknown): Promise<{ liked: boolean; count: number }> {
  if (typeof postId !== 'string' || !postId) {
    throw new HttpsError('invalid-argument', '게시물을 찾을 수 없습니다')
  }
  const db = getDb()
  const ref = db.collection('posts').doc(postId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', '게시물을 찾을 수 없습니다')
  }

  const authorUid = snap.data()?.authorUid as string
  // 내 글이거나 친구의 글에만 누를 수 있다. 피드에 뜨지 않는 글을 누르는 경로를 막는다.
  if (!(await areFriends(uid, authorUid))) {
    throw new HttpsError('permission-denied', '친구의 게시물에만 누를 수 있습니다')
  }

  const likes: string[] = Array.isArray(snap.data()?.likes) ? snap.data()!.likes : []
  const liked = likes.includes(uid)

  await ref.update({
    likes: liked ? FieldValue.arrayRemove(uid) : FieldValue.arrayUnion(uid),
  })

  // 글쓴이에게 알림을 남긴다. 게시물은 클라이언트가 직접 못 읽으므로,
  // "내 글에 좋아요가 달렸다"를 알려면 이 통로가 필요하다.
  // 문서 id를 (게시물, 누른 사람)으로 고정해 눌렀다 취소하기를 반복해도 쌓이지 않는다.
  if (authorUid !== uid) {
    const notif = db.doc(`notifications/${authorUid}/items/like_${postId}_${uid}`)
    if (liked) await notif.delete()
    else {
      await notif.set({
        kind: 'like',
        actorUid: uid,
        postId,
        createdAt: new Date().toISOString(),
      })
      // 알림함에서 누른 것과 같은 곳으로 데려간다 — 피드에서 그 글.
      await sendPush(authorUid, 'like', uid, `/friends?view=feed&post=${postId}`)
    }
  }

  return { liked: !liked, count: liked ? likes.length - 1 : likes.length + 1 }
}

export const toggleLike = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return toggleLikeHandler(req.auth.uid, req.data?.postId)
})

/**
 * 게시물에 좋아요를 누른 사람 목록.
 *
 * 이름을 **서버에서 가린다.** 이 앱은 프로필 조회를 "나와 친구 요청이 오간 상대"로
 * 제한하는데, 누른 사람 전원의 이름을 내려주면 그 선을 넘는다 — 같은 글에 좋아요를
 * 누른 친구의 친구끼리 서로 이름을 알게 된다. 화면에서 가리면 응답을 뜯어보면 되므로
 * 아예 보내지 않는다.
 *
 * 피드 응답에는 싣지 않는다. 사용자가 좋아요 수를 눌렀을 때만 부른다 —
 * 피드마다 누른 사람 프로필을 조회하면 읽기 횟수가 배로 늘어난다.
 */
export async function getPostLikesHandler(
  viewerUid: string,
  postId: unknown,
): Promise<{ displayName: string; photoURL: string; known: boolean }[]> {
  if (typeof postId !== 'string' || !postId) {
    throw new HttpsError('invalid-argument', '게시물을 찾을 수 없습니다')
  }
  const db = getDb()
  const snap = await db.collection('posts').doc(postId).get()
  if (!snap.exists) {
    throw new HttpsError('not-found', '게시물을 찾을 수 없습니다')
  }
  // 내가 볼 수 없는 글의 좋아요 목록도 볼 수 없다.
  if (!(await areFriends(viewerUid, snap.data()?.authorUid as string))) {
    throw new HttpsError('permission-denied', '볼 수 없는 게시물입니다')
  }

  const likes: string[] = Array.isArray(snap.data()?.likes) ? snap.data()!.likes : []
  if (likes.length === 0) return []

  const knownFlags = await Promise.all(likes.map((u) => areFriends(viewerUid, u)))
  const knownUids = likes.filter((_, i) => knownFlags[i])
  const profiles = new Map(
    (await Promise.all(knownUids.map((u) => db.collection('users').doc(u).get()))).map((d) => [d.id, d.data()]),
  )

  // 아는 이름이 먼저 보여야 쓸모가 있다. 모르는 사람은 아래로 묶는다.
  return [
    ...knownUids.map((u) => ({
      displayName: (profiles.get(u)?.displayName as string) || '',
      photoURL: (profiles.get(u)?.photoURL as string) || '',
      known: true,
    })),
    ...likes.filter((_, i) => !knownFlags[i]).map(() => ({ displayName: '', photoURL: '', known: false })),
  ]
}

export const getPostLikes = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return getPostLikesHandler(req.auth.uid, req.data?.postId)
})

export async function deletePostHandler(uid: string, postId: string): Promise<{ ok: true }> {
  const db = getFirestore()
  const ref = db.collection('posts').doc(postId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', '게시물을 찾을 수 없습니다')
  }
  if (snap.data()?.authorUid !== uid) {
    throw new HttpsError('permission-denied', '본인 게시물만 삭제할 수 있습니다')
  }
  await ref.delete()
  return { ok: true }
}

export const deletePost = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  const postId = String(req.data?.postId ?? '').trim()
  if (!postId) {
    throw new HttpsError('invalid-argument', 'postId가 필요합니다')
  }
  return deletePostHandler(req.auth.uid, postId)
})

/** 알림함에 남겨둘 최대 건수. 넘치면 오래된 것부터 정리한다. */
const NOTIFICATION_KEEP = 100
/** 눌러보지 않아도 이만큼 지나면 정리한다. */
const NOTIFICATION_MAX_AGE_DAYS = 90

/**
 * 읽은 알림을 지우고, 겸사겸사 묵은 알림을 정리한다.
 *
 * 알림은 보안 규칙상 서버만 쓸 수 있어서(남의 알림함에 아무거나 꽂지 못하게) 여기를 거친다.
 * 화면에서만 가리면 문서가 영영 남아 읽기량과 저장이 계속 늘어난다.
 *
 * 정리까지 같이 하는 이유 — 알림을 한 번도 안 누르는 사람의 알림함은 줄어들 계기가 없다.
 */
export async function dismissNotificationsHandler(uid: string, ids: unknown): Promise<{ removed: number }> {
  const db = getDb()
  const col = db.collection(`notifications/${uid}/items`)

  // 한 번에 받는 개수를 묶는다. 화면에서 누를 수 있는 건 어차피 한 번에 하나다.
  const asked = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && !!x).slice(0, 50) : []

  const cutoff = new Date(Date.now() - NOTIFICATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [overflow, stale] = await Promise.all([
    col.orderBy('createdAt', 'desc').offset(NOTIFICATION_KEEP).get(),
    col.where('createdAt', '<', cutoff).get(),
  ])

  // 세 갈래가 겹칠 수 있으니 경로로 한 번 걸러낸다.
  const refs = new Map<string, FirebaseFirestore.DocumentReference>()
  for (const id of asked) refs.set(`${col.path}/${id}`, col.doc(id))
  for (const d of [...overflow.docs, ...stale.docs]) refs.set(d.ref.path, d.ref)

  const list = [...refs.values()]
  for (let i = 0; i < list.length; i += 400) {
    const batch = db.batch()
    list.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
  return { removed: list.length }
}

export const dismissNotifications = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return dismissNotificationsHandler(req.auth.uid, req.data?.ids)
})

/* ─────────────── 독서 챌린지 ─────────────── */

/** 한 사람의 기록. reading-notes 문서에서 날짜에 필요한 것만 추린 모양. */
interface ReadingNotes {
  books?: { createdAt?: unknown; finishedAt?: unknown; readDates?: unknown }[]
  quotes?: { createdAt?: unknown }[]
  words?: { createdAt?: unknown }[]
}

/**
 * 저장된 값 → 날짜.
 *
 * 시각은 UTC로 저장되므로 그냥 자르면 한국 새벽(자정~오전 9시) 기록이 전날로 잡힌다.
 * 서버는 기기 시간대를 알 수 없어 **서울 기준**으로 옮긴다 — 함수도 쓰는 사람도 한국에 있다.
 * 짝: src/lib/day.ts의 isoToDay(거기선 기기 시간 기준). 해외에서 쓰면 하루 어긋날 수 있다.
 *
 * 날짜만 있는 값(달력에서 고른 읽은 날)은 그대로 둔다.
 */
function dayOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 10) return null
  if (value.length === 10) return value
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * 기간 안에 기록을 남긴 **날 수**.
 *
 * 책 추가·완독, 문장·단어 저장에 더해 달력에 고른 읽은 날(readDates)도 센다.
 * 짝: src/lib/insights.ts의 recordedDays. 한쪽을 고치면 다른 쪽도 고쳐야 한다.
 *
 * 클라이언트가 보낸 숫자를 믿지 않고 여기서 세는 이유 — 겨루는 기능이라 고쳐 보낼 수 있다.
 * 날짜만 모으고 **무슨 책을 읽었는지는 꺼내지 않는다.** 비공개 책도 날짜에는 들어간다.
 */
export function countRecordedDays(notes: ReadingNotes | undefined, from: string, to: string): number {
  if (!notes) return 0
  const days = new Set<string>()
  const add = (value: unknown) => {
    const d = dayOf(value)
    // 하루에 여러 번 기록해도 Set이 하루로 묶는다.
    if (d && d >= from && d <= to) days.add(d)
  }
  for (const b of notes.books ?? []) {
    add(b.createdAt)
    add(b.finishedAt)
    if (Array.isArray(b.readDates)) b.readDates.forEach(add)
  }
  for (const q of notes.quotes ?? []) add(q.createdAt)
  for (const w of notes.words ?? []) add(w.createdAt)
  return days.size
}

/** 한 챌린지에 들어올 수 있는 최대 인원. 현황을 볼 때 참여자 수만큼 문서를 읽으므로 상한을 둔다. */
const CHALLENGE_MAX_MEMBERS = 20
/** 기간 상한. 달 단위로 쓰므로 한 달을 넘지 않는다. */
const CHALLENGE_MAX_DAYS = 31

/** YYYY-MM-DD 형식이고 실제로 있는 날짜인지. */
export function isDayString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** 양끝을 포함한 날 수. 2026-10-01 ~ 2026-10-03이면 3이다. */
export function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.floor((b - a) / 86400000) + 1
}

/**
 * 서울 기준 오늘.
 *
 * UTC로 자르면 자정 직후(한국 시간)에 전날로 나온다 — 사용자가 보는 날짜와 어긋난다.
 * 함수가 asia-northeast3에 있고 쓰는 사람도 한국이라 서울을 기준으로 둔다.
 */
export function todayInSeoul(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** 챌린지 문서에서 쓰는 모양. */
interface Challenge {
  ownerUid: string
  from: string
  to: string
  goalDays: number
  members: string[]
  invited: string[]
  createdAt: string
}

/**
 * 챌린지를 만든다. 만든 사람이 곧 첫 참여자다.
 *
 * 기간과 목표는 만들 때 못 박는다 — 중간에 목표를 낮출 수 있으면 겨루는 의미가 없다.
 */
export async function createChallengeHandler(
  uid: string,
  data: { from?: unknown; to?: unknown; goalDays?: unknown; invite?: unknown },
): Promise<{ id: string }> {
  const { from, to } = data
  if (!isDayString(from) || !isDayString(to)) {
    throw new HttpsError('invalid-argument', '기간을 올바르게 정해주세요')
  }
  if (from > to) {
    throw new HttpsError('invalid-argument', '끝나는 날이 시작하는 날보다 빠릅니다')
  }
  const span = daysInclusive(from, to)
  if (span > CHALLENGE_MAX_DAYS) {
    throw new HttpsError('invalid-argument', '기간은 한 달까지예요')
  }
  if (to < todayInSeoul()) {
    throw new HttpsError('invalid-argument', '이미 지난 기간으로는 만들 수 없어요')
  }

  const goalDays = typeof data.goalDays === 'number' ? Math.floor(data.goalDays) : NaN
  if (!Number.isFinite(goalDays) || goalDays < 1 || goalDays > span) {
    throw new HttpsError('invalid-argument', `목표는 1일에서 ${span}일 사이로 정해주세요`)
  }

  const invite = Array.isArray(data.invite)
    ? [...new Set(data.invite.filter((x): x is string => typeof x === 'string' && !!x && x !== uid))]
    : []
  if (invite.length + 1 > CHALLENGE_MAX_MEMBERS) {
    throw new HttpsError('invalid-argument', `한 챌린지에는 ${CHALLENGE_MAX_MEMBERS}명까지 들어올 수 있어요`)
  }
  // 친구가 아닌 사람을 부를 수 없다. 모르는 사람에게 초대가 가면 안 된다.
  const friendFlags = await Promise.all(invite.map((u) => areFriends(uid, u)))
  if (friendFlags.some((ok) => !ok)) {
    throw new HttpsError('permission-denied', '친구만 부를 수 있어요')
  }

  const db = getDb()
  const ref = db.collection('challenges').doc()
  await ref.set({
    ownerUid: uid,
    from,
    to,
    goalDays,
    members: [uid],
    invited: invite,
    createdAt: new Date().toISOString(),
  } satisfies Challenge)
  return { id: ref.id }
}

/** 챌린지 문서를 읽고 없으면 거부한다. */
async function getChallenge(id: unknown): Promise<{ ref: FirebaseFirestore.DocumentReference; data: Challenge }> {
  if (typeof id !== 'string' || !id) {
    throw new HttpsError('invalid-argument', '챌린지를 찾을 수 없습니다')
  }
  const ref = getDb().collection('challenges').doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', '챌린지를 찾을 수 없습니다')
  }
  return { ref, data: snap.data() as Challenge }
}

/** 친구를 더 부른다. 방장만 할 수 있다. */
export async function inviteToChallengeHandler(
  uid: string,
  data: { challengeId?: unknown; toUid?: unknown },
): Promise<{ ok: true }> {
  const { ref, data: c } = await getChallenge(data.challengeId)
  if (c.ownerUid !== uid) {
    throw new HttpsError('permission-denied', '만든 사람만 부를 수 있어요')
  }
  const toUid = String(data.toUid ?? '').trim()
  if (!toUid || toUid === uid) {
    throw new HttpsError('invalid-argument', '부를 사람이 필요합니다')
  }
  if (c.to < todayInSeoul()) {
    throw new HttpsError('failed-precondition', '이미 끝난 챌린지예요')
  }
  if (!(await areFriends(uid, toUid))) {
    throw new HttpsError('permission-denied', '친구만 부를 수 있어요')
  }
  if (c.members.includes(toUid)) return { ok: true }
  if (c.members.length + c.invited.length + 1 > CHALLENGE_MAX_MEMBERS) {
    throw new HttpsError('failed-precondition', `한 챌린지에는 ${CHALLENGE_MAX_MEMBERS}명까지 들어올 수 있어요`)
  }
  // 원소 단위로 더해서 같은 사람을 두 번 불러도 쌓이지 않는다.
  await ref.update({ invited: FieldValue.arrayUnion(toUid) })
  return { ok: true }
}

/** 초대를 받아들인다. 초대받은 사람만 할 수 있다. */
export async function joinChallengeHandler(uid: string, data: { challengeId?: unknown }): Promise<{ ok: true }> {
  const { ref, data: c } = await getChallenge(data.challengeId)
  if (c.members.includes(uid)) return { ok: true }
  if (!c.invited.includes(uid)) {
    throw new HttpsError('permission-denied', '초대받지 않은 챌린지예요')
  }
  if (c.to < todayInSeoul()) {
    throw new HttpsError('failed-precondition', '이미 끝난 챌린지예요')
  }
  if (c.members.length + 1 > CHALLENGE_MAX_MEMBERS) {
    throw new HttpsError('failed-precondition', `한 챌린지에는 ${CHALLENGE_MAX_MEMBERS}명까지 들어올 수 있어요`)
  }
  await ref.update({ members: FieldValue.arrayUnion(uid), invited: FieldValue.arrayRemove(uid) })
  return { ok: true }
}

/** 초대를 물린다. 조용히 사라진다 — 거절을 알리지 않는다(친구 요청과 같은 기준). */
export async function declineChallengeHandler(uid: string, data: { challengeId?: unknown }): Promise<{ ok: true }> {
  const { ref, data: c } = await getChallenge(data.challengeId)
  if (!c.invited.includes(uid)) {
    throw new HttpsError('permission-denied', '초대받지 않은 챌린지예요')
  }
  await ref.update({ invited: FieldValue.arrayRemove(uid) })
  return { ok: true }
}

/** 챌린지를 지운다. 방장만 할 수 있다. */
export async function deleteChallengeHandler(uid: string, data: { challengeId?: unknown }): Promise<{ ok: true }> {
  const { ref, data: c } = await getChallenge(data.challengeId)
  if (c.ownerUid !== uid) {
    throw new HttpsError('permission-denied', '만든 사람만 지울 수 있어요')
  }
  await ref.delete()
  return { ok: true }
}

const callable = { region: 'asia-northeast3', enforceAppCheck: true } as const

export const createChallenge = onCall(callable, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  return createChallengeHandler(req.auth.uid, req.data ?? {})
})
export const inviteToChallenge = onCall(callable, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  return inviteToChallengeHandler(req.auth.uid, req.data ?? {})
})
export const joinChallenge = onCall(callable, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  return joinChallengeHandler(req.auth.uid, req.data ?? {})
})
export const declineChallenge = onCall(callable, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  return declineChallengeHandler(req.auth.uid, req.data ?? {})
})
export const deleteChallenge = onCall(callable, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  return deleteChallengeHandler(req.auth.uid, req.data ?? {})
})

/* ─────────────── 푸시 발송 ─────────────── */

/**
 * 푸시 문구. **알림함과 같은 말을 해야 한다** — 같은 일을 두고 다르게 말하면 안 된다.
 * 짝: src/lib/notifications.ts의 SERVER_KINDS. 한쪽을 고치면 다른 쪽도 고쳐야 한다.
 */
const PUSH_BODY: Record<string, (actor: string) => string> = {
  friendRequest: (a) => `${a}님이 친구 요청을 보냈어요`,
  friendAccepted: (a) => `${a}님이 친구 요청을 수락했어요`,
  like: (a) => `${a}님이 회원님의 글을 좋아합니다`,
  recommend: (a) => `${a}님이 책을 권했어요`,
  recommendAccepted: (a) => `${a}님이 권한 책을 담았어요`,
}

/** 그릴 줄 모르는 종류는 보내지 않는다. 알림함과 같은 기준이다. */
export function pushBodyFor(kind: string, actorName: string): string | null {
  return PUSH_BODY[kind]?.(actorName) ?? null
}

/** 보낸 뒤 쓸모없어진 토큰인지. 기기를 바꾸거나 앱을 지우면 이렇게 돌아온다. */
function isDeadToken(code: string | undefined): boolean {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}

/**
 * 한 사람의 모든 기기로 푸시를 보낸다.
 *
 * **실패해도 부르는 쪽에 영향을 주지 않는다.** 푸시는 덤이고, 알림함이 본체다.
 * 여기서 던지면 좋아요나 책 권하기 자체가 실패해버린다.
 *
 * 알림 내용은 data로만 보낸다 — 화면에 어떻게 띄울지는 서비스워커가 정한다.
 * notification으로 보내면 브라우저마다 다르게 그려지고 두 번 뜨기도 한다.
 */
export async function sendPush(toUid: string, kind: string, actorUid: string, link: string): Promise<number> {
  try {
    const db = getDb()
    const tokensSnap = await db.collection(`users/${toUid}/fcmTokens`).get()
    if (tokensSnap.empty) return 0

    const profile = (await db.collection('users').doc(actorUid).get()).data()
    const actorName = (profile?.displayName as string)?.trim() || '친구'
    const body = pushBodyFor(kind, actorName)
    if (!body) return 0

    const tokens = tokensSnap.docs.map((d) => (d.data().token as string) ?? d.id)
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title: 'Booklog', body, url: link },
    })

    // 죽은 토큰은 거둔다. 안 그러면 보낼 때마다 실패하는 주소가 쌓인다.
    await Promise.all(
      res.responses.map((r, i) =>
        !r.success && isDeadToken(r.error?.code) ? tokensSnap.docs[i].ref.delete().catch(() => {}) : Promise.resolve(),
      ),
    )
    return res.successCount
  } catch {
    // 푸시가 안 가도 알림함은 그대로 뜬다.
    return 0
  }
}

/**
 * 친구 요청이 수락되면 **보낸 사람에게** 알린다.
 *
 * 이 알림이 없으면 요청을 보낸 사람은 받아들여졌는지조차 모른다 —
 * 앱을 열어 친구 탭까지 들어가야 알 수 있었다.
 */
export async function notifyFriendAccepted(requestId: string, fromUid: string, toUid: string): Promise<void> {
  const db = getDb()
  await db.doc(`notifications/${fromUid}/items/friendAccepted_${requestId}`).set({
    kind: 'friendAccepted',
    actorUid: toUid,
    createdAt: new Date().toISOString(),
  })
  await sendPush(fromUid, 'friendAccepted', toUid, '/friends')
}

/**
 * 수락은 받는 쪽 클라이언트가 문서를 고쳐서 한다 — 콜러블을 안 거치므로 문서 변화를 지켜본다.
 * 거절당한 뒤 다시 요청해서 수락되는 경우도 있으므로, **수락으로 바뀌는 순간**만 본다.
 */
export const onFriendRequestAccepted = onDocumentUpdated(
  { document: 'friendRequests/{requestId}', region: 'asia-northeast3' },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return
    if (before.status === 'accepted' || after.status !== 'accepted') return
    await notifyFriendAccepted(event.params.requestId, after.fromUid as string, after.toUid as string)
  },
)

/**
 * 친구 요청이 들어오면 푸시를 보낸다.
 *
 * 요청은 클라이언트가 Firestore에 직접 쓰므로(보안 규칙으로 허용) 콜러블을 거치지 않는다.
 * 그래서 푸시를 보낼 자리가 없어 문서가 생기는 순간을 지켜본다.
 * 수락·거절은 문서 수정이라 여기 걸리지 않는다 — 그때는 푸시를 보내지 않는다.
 */
export const onFriendRequestCreated = onDocumentCreated(
  { document: 'friendRequests/{requestId}', region: 'asia-northeast3' },
  async (event) => {
    const data = event.data?.data()
    if (!data || data.status !== 'pending') return
    await sendPush(data.toUid as string, 'friendRequest', data.fromUid as string, '/friends')
  },
)

/**
 * 친구에게 책을 권한다.
 *
 * 권유는 recommendations 컬렉션에만 쌓이고 **받는 사람의 서재에는 서버가 손대지 않는다.**
 * 이 앱은 로컬스토리지가 먼저라(useData) 서버가 상대의 reading-notes에 책을 끼워 넣어도
 * 그 사람 브라우저의 로컬본이 더 최신이면 다음 저장 때 통째로 덮어쓴다 — 권한 책이 사라진다.
 * 그래서 담는 일은 받는 사람이 수락을 누를 때 그쪽 클라이언트가 기존 책 추가 경로로 한다.
 *
 * 책 내용은 보내는 쪽이 적어 보내는 게 아니라 서버가 내 서재에서 꺼낸다(발행과 같다).
 * 받는 사람 화면에 그대로 뜨는 내용이라 위조할 수 있으면 안 된다.
 */
export async function recommendBookHandler(
  uid: string,
  data: { toUid?: unknown; bookId?: unknown; message?: unknown },
): Promise<{ id: string }> {
  const toUid = String(data?.toUid ?? '').trim()
  const bookId = String(data?.bookId ?? '').trim()
  if (!toUid || !bookId) {
    throw new HttpsError('invalid-argument', '받는 사람과 책이 필요합니다')
  }
  if (toUid === uid) {
    throw new HttpsError('invalid-argument', '자기 자신에게는 권할 수 없습니다')
  }
  const message = String(data?.message ?? '').trim()
  if (message.length > 300) {
    throw new HttpsError('invalid-argument', '메모는 300자까지 쓸 수 있습니다')
  }
  if (!(await areFriends(uid, toUid))) {
    throw new HttpsError('permission-denied', '친구에게만 권할 수 있습니다')
  }

  const db = getDb()
  const notes = (await db.collection('reading-notes').doc(uid).get()).data() ?? {}
  const books: Record<string, unknown>[] = Array.isArray(notes.books) ? notes.books : []
  const book = books.find((b) => b.id === bookId)
  if (!book) {
    throw new HttpsError('invalid-argument', '책을 찾을 수 없습니다')
  }
  // 비공개로 해둔 책을 친구에게 보내면 설정과 어긋난다. 발행과 같은 기준이다.
  if (book.isPrivate) {
    throw new HttpsError('invalid-argument', '비공개 책은 권할 수 없습니다')
  }

  // 문서 id를 (보낸 사람, 받는 사람, 책)으로 고정해 같은 책이 두 번 쌓이지 않게 한다.
  const id = `${uid}_${toUid}_${bookId}`
  const ref = db.collection('recommendations').doc(id)
  if ((await ref.get()).data()?.status === 'pending') {
    throw new HttpsError('already-exists', '이미 권한 책이에요')
  }

  const createdAt = new Date().toISOString()
  await ref.set({
    fromUid: uid,
    toUid,
    createdAt,
    message,
    bookTitle: book.title ?? '',
    bookAuthor: book.author ?? '',
    bookCover: book.cover ?? '',
    status: 'pending',
  })
  await db.doc(`notifications/${toUid}/items/recommend_${id}`).set({
    kind: 'recommend',
    actorUid: uid,
    recommendationId: id,
    createdAt,
  })
  await sendPush(toUid, 'recommend', uid, '/friends')
  return { id }
}

export const recommendBook = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return recommendBookHandler(req.auth.uid, req.data ?? {})
})

/** 받은 권유 한 건. 보낸 사람 표시정보를 동봉해 클라이언트가 추가 조회 없이 그릴 수 있게 한다. */
export interface RecommendationView {
  id: string
  fromUid: string
  fromDisplayName: string
  fromPhotoURL: string
  bookTitle: string
  bookAuthor: string
  bookCover: string
  message: string
  createdAt: string
}

/**
 * 나에게 온, 아직 처리하지 않은 권유 목록.
 *
 * 정렬은 메모리에서 한다 — Firestore에서 정렬까지 시키면 (toUid, status, createdAt)
 * 복합 색인이 필요한데, 한 사람 앞으로 온 미처리 권유는 많아야 몇 건이다.
 */
export async function getRecommendationsHandler(uid: string): Promise<RecommendationView[]> {
  const db = getDb()
  const snap = await db.collection('recommendations').where('toUid', '==', uid).where('status', '==', 'pending').get()
  if (snap.empty) return []

  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
  const fromUids = [...new Set(docs.map((d) => d.fromUid as string))]
  const profiles = new Map(
    (await Promise.all(fromUids.map((u) => db.collection('users').doc(u).get()))).map((d) => [d.id, d.data()]),
  )

  return docs
    .map((d) => ({
      id: d.id as string,
      fromUid: d.fromUid as string,
      fromDisplayName: (profiles.get(d.fromUid as string)?.displayName as string) || '',
      fromPhotoURL: (profiles.get(d.fromUid as string)?.photoURL as string) || '',
      bookTitle: (d.bookTitle as string) ?? '',
      bookAuthor: (d.bookAuthor as string) ?? '',
      bookCover: (d.bookCover as string) ?? '',
      message: (d.message as string) ?? '',
      createdAt: (d.createdAt as string) ?? '',
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export const getRecommendations = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return getRecommendationsHandler(req.auth.uid)
})

/**
 * 받은 권유를 수락하거나 거절한다.
 *
 * **수락해도 서버는 책을 넣지 않는다.** 권유를 처리 완료로 바꾸고 알림만 정리한다.
 * 책을 담는 건 받는 사람의 클라이언트다 — 이유는 recommendBookHandler 주석 참고.
 */
export async function respondRecommendationHandler(
  uid: string,
  data: { id?: unknown; accept?: unknown },
): Promise<{ ok: true }> {
  const id = String(data?.id ?? '').trim()
  if (!id) {
    throw new HttpsError('invalid-argument', '권유를 찾을 수 없습니다')
  }
  const accept = data?.accept === true

  const db = getDb()
  const ref = db.collection('recommendations').doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', '권유를 찾을 수 없습니다')
  }
  const rec = snap.data() ?? {}
  if (rec.toUid !== uid) {
    throw new HttpsError('permission-denied', '나에게 온 권유가 아닙니다')
  }
  if (rec.status !== 'pending') {
    throw new HttpsError('failed-precondition', '이미 처리한 권유예요')
  }

  const now = new Date().toISOString()
  await ref.update({ status: accept ? 'accepted' : 'rejected', respondedAt: now })
  // 처리했는데 알림함에 계속 떠 있으면 안 된다.
  await db.doc(`notifications/${uid}/items/recommend_${id}`).delete()

  // 수락만 알린다. 거절은 알리지 않는다 — 친구 요청과 같은 기준이고,
  // 거절당한 사실이 알림으로 오면 다음에 권하기가 껄끄러워진다.
  if (accept) {
    await db.doc(`notifications/${rec.fromUid}/items/recaccepted_${id}`).set({
      kind: 'recommendAccepted',
      actorUid: uid,
      recommendationId: id,
      createdAt: now,
    })
    await sendPush(rec.fromUid as string, 'recommendAccepted', uid, '/friends')
  }
  return { ok: true }
}

export const respondRecommendation = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return respondRecommendationHandler(req.auth.uid, req.data ?? {})
})

// Vision SDK는 무겁다. 최상단에서 import하면 이 파일에 함께 배포된 함수 전부가
// (OCR과 무관한 친구 피드·책 검색까지) 콜드 스타트마다 이걸 로딩해 그만큼 느려진다.
// 그래서 OCR을 실제로 부를 때 처음 한 번만 불러오고, 이후 호출은 만들어둔 클라이언트를 재사용한다.
type VisionClient = { documentTextDetection: (req: unknown) => Promise<[{ fullTextAnnotation?: { text?: string } }]> }
let visionClientPromise: Promise<VisionClient> | null = null
function getVisionClient(): Promise<VisionClient> {
  if (!visionClientPromise) {
    visionClientPromise = import('@google-cloud/vision').then(
      (m) => new m.ImageAnnotatorClient() as unknown as VisionClient,
    )
  }
  return visionClientPromise
}

/** base64 하나당 최대 6MB. 클라이언트가 이미 1600px로 줄여 보내므로 정상 요청은 이 값에 한참 못 미친다. */
const MAX_OCR_IMAGE_BASE64_LENGTH = 6_000_000

export async function ocrBookPageHandler(base64Image: string): Promise<string> {
  if (!base64Image || base64Image.length > MAX_OCR_IMAGE_BASE64_LENGTH) {
    throw new HttpsError('invalid-argument', '이미지 데이터가 없거나 너무 큽니다')
  }

  const client = await getVisionClient()
  const [result] = await client.documentTextDetection({
    image: { content: Buffer.from(base64Image, 'base64') },
  })
  return result.fullTextAnnotation?.text ?? ''
}

/** 책 페이지 사진에서 텍스트를 인식한다(OCR). 인식된 문단 텍스트만 돌려주고 이미지 자체는 저장하지 않는다. */
export const ocrBookPage = onCall(
  { region: 'asia-northeast3', enforceAppCheck: true, timeoutSeconds: 60 },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다')
    }
    const base64Image = String(req.data?.base64Image ?? '')
    try {
      return await ocrBookPageHandler(base64Image)
    } catch (err) {
      if (err instanceof HttpsError) throw err
      throw new HttpsError('internal', '텍스트 인식 중 오류가 발생했습니다')
    }
  },
)

/**
 * 회원 탈퇴. 이 사용자와 얽힌 것을 전부 지운다.
 *
 * 클라이언트에서 처리하지 않고 서버에 둔 이유: posts는 보안 규칙이 클라이언트 쓰기를 전면
 * 차단하고 있어(스냅샷 위조 방지) 본인도 직접 지울 수 없다. 게시물만 남으면 탈퇴한 사람의
 * 이름·사진이 친구 피드에 계속 보이므로, Admin 권한으로 한 번에 정리한다.
 *
 * 삭제 순서: 데이터 → Auth 계정. 반대로 하면 계정이 사라진 뒤 데이터 삭제가 실패했을 때
 * 주인 없는 데이터가 남아 손댈 방법이 없어진다.
 */
/**
 * 탈퇴할 때 지울 Firestore 데이터를 전부 정리한다. Auth 계정 삭제는 부르는 쪽이 한다 —
 * 그래야 Auth 에뮬레이터 없이 이 정리만 따로 테스트할 수 있다.
 *
 * 내 문서만 지워서는 부족하다. 내가 남긴 알림은 **남의 알림함**에 들어 있어서,
 * 그대로 두면 탈퇴한 사람이 권한 책이 상대 목록에 계속 뜨고 「내가 모르는 친구」로 남는다.
 */
export async function deleteUserDataHandler(uid: string) {
  const db = getDb()

  const [posts, outgoing, incoming, myNotifications, recsFrom, recsTo, likedPosts, fcmTokens] = await Promise.all([
    db.collection('posts').where('authorUid', '==', uid).get(),
    db.collection('friendRequests').where('fromUid', '==', uid).get(),
    db.collection('friendRequests').where('toUid', '==', uid).get(),
    db.collection(`notifications/${uid}/items`).get(),
    db.collection('recommendations').where('fromUid', '==', uid).get(),
    db.collection('recommendations').where('toUid', '==', uid).get(),
    db.collection('posts').where('likes', 'array-contains', uid).get(),
    db.collection(`users/${uid}/fcmTokens`).get(),
  ])

  // 내가 일으켜서 남의 알림함에 들어간 것들. 문서 id가 정해진 규칙이라 조회 없이 바로 짚을 수 있다.
  // 이미 없는 문서를 지우는 건 아무 일도 하지 않으므로, 처리된 권유까지 한꺼번에 넣어도 된다.
  const notificationsILeft = [
    ...recsFrom.docs.map((d) => db.doc(`notifications/${d.data().toUid}/items/recommend_${d.id}`)),
    ...recsTo.docs.map((d) => db.doc(`notifications/${d.data().fromUid}/items/recaccepted_${d.id}`)),
    ...likedPosts.docs
      .filter((d) => d.data().authorUid !== uid)
      .map((d) => db.doc(`notifications/${d.data().authorUid}/items/like_${d.id}_${uid}`)),
    // 내가 수락해서 상대 알림함에 남긴 것
    ...incoming.docs
      .filter((d) => d.data().status === 'accepted')
      .map((d) => db.doc(`notifications/${d.data().fromUid}/items/friendAccepted_${d.id}`)),
  ]

  const docs = [
    ...posts.docs.map((d) => d.ref),
    ...outgoing.docs.map((d) => d.ref),
    ...incoming.docs.map((d) => d.ref),
    ...myNotifications.docs.map((d) => d.ref),
    ...fcmTokens.docs.map((d) => d.ref),
    ...recsFrom.docs.map((d) => d.ref),
    ...recsTo.docs.map((d) => d.ref),
    ...notificationsILeft,
    db.collection('reading-notes').doc(uid),
    db.collection('users').doc(uid),
  ]

  // 배치 한 번에 500개까지만 담을 수 있다. 게시물이 많은 사용자를 대비해 나눠 커밋한다.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch()
    docs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  // 남의 글에 눌러둔 좋아요를 거둔다. 안 그러면 없는 사람이 센 수가 그대로 남는다.
  // 내 글은 위에서 통째로 지웠으므로 건드리지 않는다.
  const othersILiked = likedPosts.docs.filter((d) => d.data().authorUid !== uid)
  for (let i = 0; i < othersILiked.length; i += 400) {
    const batch = db.batch()
    othersILiked.slice(i, i + 400).forEach((d) => batch.update(d.ref, { likes: FieldValue.arrayRemove(uid) }))
    await batch.commit()
  }

  return {
    posts: posts.size,
    friendRequests: outgoing.size + incoming.size,
    notifications: myNotifications.size + notificationsILeft.length,
    fcmTokens: fcmTokens.size,
    recommendations: recsFrom.size + recsTo.size,
    likes: othersILiked.length,
  }
}

export async function deleteAccountHandler(uid: string) {
  const deleted = await deleteUserDataHandler(uid)
  await getAuth().deleteUser(uid)
  return { ok: true as const, deleted }
}

export const deleteAccount = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return deleteAccountHandler(req.auth.uid)
})
