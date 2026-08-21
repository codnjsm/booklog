import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

const kakaoRestApiKey = defineSecret('KAKAO_REST_API_KEY')
const opendictApiKey = defineSecret('OPENDICT_API_KEY')

export const kakaoBookSearch = onRequest(
  { cors: true, secrets: [kakaoRestApiKey], region: 'asia-northeast3', invoker: 'public' },
  async (req, res) => {
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
  }
)

export const koreanDictSearch = onRequest(
  { cors: true, secrets: [opendictApiKey], region: 'asia-northeast3', invoker: 'public' },
  async (req, res) => {
    const query = req.query.query as string
    if (!query) {
      res.status(400).json({ error: 'query required' })
      return
    }
    const url = `https://opendict.korean.go.kr/api/search?key=${opendictApiKey.value()}&q=${encodeURIComponent(query)}&req_type=json&part=word&num=20`
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  }
)
