import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAppCheck } from 'firebase-admin/app-check'
import { getAuth } from 'firebase-admin/auth'
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
    else
      await notif.set({
        kind: 'like',
        actorUid: uid,
        postId,
        createdAt: new Date().toISOString(),
      })
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
export async function deleteAccountHandler(uid: string) {
  const db = getDb()

  const [posts, outgoing, incoming] = await Promise.all([
    db.collection('posts').where('authorUid', '==', uid).get(),
    db.collection('friendRequests').where('fromUid', '==', uid).get(),
    db.collection('friendRequests').where('toUid', '==', uid).get(),
  ])

  const docs = [
    ...posts.docs.map((d) => d.ref),
    ...outgoing.docs.map((d) => d.ref),
    ...incoming.docs.map((d) => d.ref),
    db.collection('reading-notes').doc(uid),
    db.collection('users').doc(uid),
  ]

  // 배치 한 번에 500개까지만 담을 수 있다. 게시물이 많은 사용자를 대비해 나눠 커밋한다.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch()
    docs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  await getAuth().deleteUser(uid)
  return { ok: true as const, deleted: { posts: posts.size, friendRequests: outgoing.size + incoming.size } }
}

export const deleteAccount = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  return deleteAccountHandler(req.auth.uid)
})
