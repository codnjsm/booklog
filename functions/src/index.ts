import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAppCheck } from 'firebase-admin/app-check'
import type { Request, Response } from 'express'

initializeApp()

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
