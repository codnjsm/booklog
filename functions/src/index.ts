import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAppCheck } from 'firebase-admin/app-check'
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
    const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&size=15`
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

/**
 * 이메일로 친구를 찾는다.
 * 클라이언트가 users 컬렉션을 직접 조회하면 전체 회원 목록을 덤프할 수 있어서,
 * 서버에서 정확히 일치하는 한 명만 찾아서 돌려준다.
 */
export const findUserByEmail = onCall({ region: 'asia-northeast3', enforceAppCheck: true }, async (req) => {
  if (!req.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다')
  }
  const email = String(req.data?.email ?? '')
    .trim()
    .toLowerCase()
  if (!email) {
    throw new HttpsError('invalid-argument', '이메일이 필요합니다')
  }

  const snap = await getFirestore().collection('users').where('email', '==', email).limit(1).get()

  if (snap.empty) return null

  const doc = snap.docs[0]
  const data = doc.data()
  return {
    uid: doc.id,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    photoURL: data.photoURL ?? '',
  }
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
): Promise<{ id: string }> {
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

  const doc = await db.collection('posts').add({
    authorUid: uid,
    createdAt: new Date().toISOString(),
    caption,
    attachment,
  })
  return { id: doc.id }
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

  const postsSnap = await db.collection('posts').where('authorUid', 'in', authorUids).get()
  const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
  posts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const top = posts.slice(0, 50)

  const uniqueAuthors = [...new Set(top.map((p) => p.authorUid as string))]
  const profileDocs = await Promise.all(uniqueAuthors.map((u) => db.collection('users').doc(u).get()))
  const profiles = new Map(profileDocs.map((d) => [d.id, d.data()]))

  return top.map((p) => ({
    ...p,
    authorDisplayName: profiles.get(p.authorUid as string)?.displayName ?? '',
    authorPhotoURL: profiles.get(p.authorUid as string)?.photoURL ?? '',
  }))
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
