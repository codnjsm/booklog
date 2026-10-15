// 책 권하기 콜러블 로직 테스트. likes.test.mjs와 같은 방식으로 handler를 직접 부른다.
//   npm run test:rules
import {
  recommendBookHandler,
  getRecommendationsHandler,
  respondRecommendationHandler,
  getDb,
} from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const ANNA = 'anna-r' // 권하는 사람
const BORA = 'bora-r' // ANNA의 친구
const CHAN = 'chan-r' // ANNA의 친구가 아님

let db

before(() => {
  db = getDb()
})

function assertHttpsCode(promise, code) {
  return assert.rejects(promise, (err) => err.code === code)
}

async function makeFriends(a, b) {
  await db.doc(`friendRequests/${a}_${b}`).set({ fromUid: a, toUid: b, status: 'accepted', createdAt: '2026-01-01' })
}

async function giveBooks(uid, books) {
  await db.doc(`reading-notes/${uid}`).set({ books, quotes: [], words: [] })
}

async function notifications(uid) {
  return (await db.collection(`notifications/${uid}/items`).get()).docs.map((d) => ({ id: d.id, ...d.data() }))
}

// 다른 테스트 파일과 같은 에뮬레이터 세션을 쓰므로, 이 파일이 만든 것만 지운다.
const MINE = [ANNA, BORA, CHAN]

beforeEach(async () => {
  for (const u of MINE) {
    for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
    await db.doc(`reading-notes/${u}`).delete()
    await db.doc(`users/${u}`).delete()
  }
  const recs = await db.collection('recommendations').where('fromUid', 'in', MINE).get()
  for (const d of recs.docs) await d.ref.delete()
  for (const a of MINE) {
    for (const b of MINE) {
      if (a !== b) await db.doc(`friendRequests/${a}_${b}`).delete()
    }
  }

  await makeFriends(ANNA, BORA)
  await db.doc(`users/${ANNA}`).set({ displayName: '안나', photoURL: 'https://x/anna.png', email: 'anna@x.com' })
  await giveBooks(ANNA, [
    { id: 'b1', title: '소년이 온다', author: '한강', cover: 'https://x/cover.png', status: 'done', rating: 5 },
    { id: 'secret', title: '비밀의 책', author: '누구', cover: '', status: 'done', rating: 5, isPrivate: true },
  ])
})

describe('recommendBook', () => {
  it('친구에게 권하면 권유가 생기고 상대에게 알림이 간다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1', message: '이거 꼭 읽어봐' })

    const rec = (await db.doc(`recommendations/${id}`).get()).data()
    assert.equal(rec.fromUid, ANNA)
    assert.equal(rec.toUid, BORA)
    assert.equal(rec.status, 'pending')
    assert.equal(rec.bookTitle, '소년이 온다')
    assert.equal(rec.message, '이거 꼭 읽어봐')

    const notis = await notifications(BORA)
    assert.equal(notis.length, 1)
    assert.equal(notis[0].kind, 'recommend')
    assert.equal(notis[0].actorUid, ANNA)
    assert.equal(notis[0].recommendationId, id)
  })

  it('친구가 아닌 사람에게는 권할 수 없다', async () => {
    await assertHttpsCode(recommendBookHandler(ANNA, { toUid: CHAN, bookId: 'b1' }), 'permission-denied')
  })

  it('자기 자신에게는 권할 수 없다', async () => {
    await assertHttpsCode(recommendBookHandler(ANNA, { toUid: ANNA, bookId: 'b1' }), 'invalid-argument')
  })

  it('내 서재에 없는 책은 권할 수 없다', async () => {
    await assertHttpsCode(recommendBookHandler(ANNA, { toUid: BORA, bookId: '없는책' }), 'invalid-argument')
  })

  it('비공개 책은 권할 수 없다', async () => {
    await assertHttpsCode(recommendBookHandler(ANNA, { toUid: BORA, bookId: 'secret' }), 'invalid-argument')
  })

  it('메모는 없어도 된다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    assert.equal((await db.doc(`recommendations/${id}`).get()).data().message, '')
  })

  it('메모가 300자를 넘으면 거부된다', async () => {
    const long = '가'.repeat(301)
    await assertHttpsCode(recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1', message: long }), 'invalid-argument')
  })

  it('같은 친구에게 같은 책을 두 번 권해도 쌓이지 않는다', async () => {
    await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await assertHttpsCode(recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' }), 'already-exists')
    const all = await db.collection('recommendations').where('fromUid', '==', ANNA).get()
    assert.equal(all.size, 1)
  })

  it('독후감·별점 같은 다른 필드가 묻어 나가지 않는다', async () => {
    await giveBooks(ANNA, [
      { id: 'b1', title: '소년이 온다', author: '한강', cover: '', status: 'done', rating: 5, review: '내 독후감' },
    ])
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    const rec = (await db.doc(`recommendations/${id}`).get()).data()
    assert.deepEqual(
      Object.keys(rec).sort(),
      ['bookAuthor', 'bookCover', 'bookTitle', 'createdAt', 'fromUid', 'message', 'status', 'toUid'].sort(),
    )
    assert.ok(!JSON.stringify(rec).includes('내 독후감'))
  })
})

describe('getRecommendations', () => {
  it('나에게 온 권유만 온다', async () => {
    await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1', message: '추천' })

    const mine = await getRecommendationsHandler(BORA)
    assert.equal(mine.length, 1)
    assert.equal(mine[0].bookTitle, '소년이 온다')
    assert.equal(mine[0].fromDisplayName, '안나')
    assert.equal(mine[0].message, '추천')

    assert.deepEqual(await getRecommendationsHandler(CHAN), [])
    assert.deepEqual(await getRecommendationsHandler(ANNA), [])
  })

  it('처리한 권유는 목록에서 빠진다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await respondRecommendationHandler(BORA, { id, accept: true })
    assert.deepEqual(await getRecommendationsHandler(BORA), [])
  })

  it('받은 권유가 없으면 빈 목록', async () => {
    assert.deepEqual(await getRecommendationsHandler(BORA), [])
  })
})

describe('respondRecommendation', () => {
  it('수락하면 권한 사람에게 알림이 가고, 받은 사람 알림은 치워진다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await respondRecommendationHandler(BORA, { id, accept: true })

    assert.equal((await db.doc(`recommendations/${id}`).get()).data().status, 'accepted')
    assert.deepEqual(await notifications(BORA), [])

    const notis = await notifications(ANNA)
    assert.equal(notis.length, 1)
    assert.equal(notis[0].kind, 'recommendAccepted')
    assert.equal(notis[0].actorUid, BORA)
  })

  it('수락해도 서버는 받는 사람 서재에 책을 넣지 않는다', async () => {
    await giveBooks(BORA, [])
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await respondRecommendationHandler(BORA, { id, accept: true })

    const notes = (await db.doc(`reading-notes/${BORA}`).get()).data()
    assert.deepEqual(notes.books, [])
  })

  it('거절하면 아무에게도 알림이 가지 않는다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await respondRecommendationHandler(BORA, { id, accept: false })

    assert.equal((await db.doc(`recommendations/${id}`).get()).data().status, 'rejected')
    assert.deepEqual(await notifications(BORA), [])
    assert.deepEqual(await notifications(ANNA), [])
  })

  it('남의 권유는 처리할 수 없다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await assertHttpsCode(respondRecommendationHandler(CHAN, { id, accept: true }), 'permission-denied')
    await assertHttpsCode(respondRecommendationHandler(ANNA, { id, accept: true }), 'permission-denied')
  })

  it('이미 처리한 권유는 다시 처리할 수 없다', async () => {
    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })
    await respondRecommendationHandler(BORA, { id, accept: false })
    await assertHttpsCode(respondRecommendationHandler(BORA, { id, accept: true }), 'failed-precondition')
  })

  it('없는 권유는 거부된다', async () => {
    await assertHttpsCode(respondRecommendationHandler(BORA, { id: '없는권유', accept: true }), 'not-found')
  })
})
