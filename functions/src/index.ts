import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

const naverClientId = defineSecret('NAVER_CLIENT_ID')
const naverClientSecret = defineSecret('NAVER_CLIENT_SECRET')
const opendictApiKey = defineSecret('OPENDICT_API_KEY')

export const naverBookSearch = onRequest(
  { cors: true, secrets: [naverClientId, naverClientSecret], region: 'asia-northeast3', invoker: 'public' },
  async (req, res) => {
    const query = req.query.query as string
    if (!query) {
      res.status(400).json({ error: 'query required' })
      return
    }
    const url = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=15`
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': naverClientId.value(),
        'X-Naver-Client-Secret': naverClientSecret.value(),
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
