// 푸시 발송 테스트.
//
// 에뮬레이터에는 FCM이 없어서 실제 발송은 늘 실패한다. 그게 오히려 중요한 조건이다 —
// 푸시가 실패해도 좋아요·권하기와 알림함이 멀쩡해야 한다.
//   npm run test:rules
import {
  pushBodyFor,
  sendPush,
  toggleLikeHandler,
  recommendBookHandler,
  respondRecommendationHandler,
  notifyFriendAccepted,
  getDb,
} from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const ANNA = 'anna-p'
const BORA = 'bora-p'

let db

before(() => {
  db = getDb()
})

const MINE = [ANNA, BORA]

beforeEach(async () => {
  for (const u of MINE) {
    for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
    for (const d of (await db.collection(`users/${u}/fcmTokens`).get()).docs) await d.ref.delete()
    await db.doc(`users/${u}`).delete()
    await db.doc(`reading-notes/${u}`).delete()
  }
  for (const d of (await db.collection('posts').where('authorUid', 'in', MINE).get()).docs) await d.ref.delete()
  for (const d of (await db.collection('recommendations').where('fromUid', 'in', MINE).get()).docs) await d.ref.delete()
  for (const a of MINE) for (const b of MINE) if (a !== b) await db.doc(`friendRequests/${a}_${b}`).delete()

  await db.doc(`friendRequests/${ANNA}_${BORA}`).set({ fromUid: ANNA, toUid: BORA, status: 'accepted' })
  await db.doc(`users/${ANNA}`).set({ displayName: '안나' })
  await db.doc(`users/${BORA}`).set({ displayName: '보라' })
})

describe('pushBodyFor — 푸시 문구', () => {
  it('알림함과 같은 문장을 쓴다', () => {
    assert.equal(pushBodyFor('like', '안나'), '안나님이 회원님의 글을 좋아합니다')
    assert.equal(pushBodyFor('recommend', '안나'), '안나님이 책을 권했어요')
    assert.equal(pushBodyFor('recommendAccepted', '안나'), '안나님이 권한 책을 담았어요')
    assert.equal(pushBodyFor('friendRequest', '안나'), '안나님이 친구 요청을 보냈어요')
    assert.equal(pushBodyFor('friendAccepted', '안나'), '안나님이 친구 요청을 수락했어요')
  })

  it('모르는 종류는 보내지 않는다', () => {
    assert.equal(pushBodyFor('아직_모르는_종류', '안나'), null)
  })
})

describe('sendPush — 보낼 곳이 없거나 실패할 때', () => {
  it('기기 토큰이 없으면 아무 일도 하지 않는다', async () => {
    assert.equal(await sendPush(BORA, 'like', ANNA, '/friends'), 0)
  })

  it('모르는 종류면 보내지 않는다', async () => {
    await db.doc(`users/${BORA}/fcmTokens/t1`).set({ token: 't1' })
    assert.equal(await sendPush(BORA, '아직_모르는_종류', ANNA, '/friends'), 0)
  })

  it('발송이 실패해도 던지지 않는다 — 부르는 쪽이 같이 실패하면 안 된다', async () => {
    await db.doc(`users/${BORA}/fcmTokens/t1`).set({ token: '가짜토큰' })
    assert.equal(await sendPush(BORA, 'like', ANNA, '/friends'), 0)
  })
})

describe('푸시가 실패해도 본래 기능은 돈다', () => {
  it('좋아요 — 알림함에 그대로 남는다', async () => {
    await db.doc(`users/${ANNA}/fcmTokens/t1`).set({ token: '가짜토큰' })
    const post = await db
      .collection('posts')
      .add({ authorUid: ANNA, createdAt: '2026-10-19', caption: '글', likes: [] })

    const r = await toggleLikeHandler(BORA, post.id)

    assert.equal(r.liked, true)
    assert.equal(r.count, 1)
    const notis = await db.collection(`notifications/${ANNA}/items`).get()
    assert.equal(notis.size, 1)
    assert.equal(notis.docs[0].data().kind, 'like')
  })

  it('책 권하기 — 권유와 알림이 그대로 남는다', async () => {
    await db.doc(`users/${BORA}/fcmTokens/t1`).set({ token: '가짜토큰' })
    await db.doc(`reading-notes/${ANNA}`).set({
      books: [{ id: 'b1', title: '소년이 온다', author: '한강', cover: '', status: 'done' }],
    })

    const { id } = await recommendBookHandler(ANNA, { toUid: BORA, bookId: 'b1' })

    assert.equal((await db.doc(`recommendations/${id}`).get()).exists, true)
    assert.equal((await db.collection(`notifications/${BORA}/items`).get()).size, 1)
  })

  it('권한 책 담기 — 처리와 알림이 그대로 남는다', async () => {
    await db.doc(`users/${ANNA}/fcmTokens/t1`).set({ token: '가짜토큰' })
    const id = `${ANNA}_${BORA}_b2`
    await db.doc(`recommendations/${id}`).set({ fromUid: ANNA, toUid: BORA, status: 'pending', bookTitle: '책' })

    await respondRecommendationHandler(BORA, { id, accept: true })

    assert.equal((await db.doc(`recommendations/${id}`).get()).data().status, 'accepted')
    const notis = await db.collection(`notifications/${ANNA}/items`).get()
    assert.equal(notis.size, 1)
    assert.equal(notis.docs[0].data().kind, 'recommendAccepted')
  })
})

describe('notifyFriendAccepted — 요청이 수락되면 보낸 사람에게', () => {
  it('보낸 사람 알림함에 남는다', async () => {
    await notifyFriendAccepted(`${ANNA}_${BORA}`, ANNA, BORA)

    const notis = await db.collection(`notifications/${ANNA}/items`).get()
    assert.equal(notis.size, 1)
    const d = notis.docs[0]
    assert.equal(d.id, `friendAccepted_${ANNA}_${BORA}`)
    assert.equal(d.data().kind, 'friendAccepted')
    // 수락한 사람이 누구인지 — 보낸 사람이 아니라 받은 사람이다
    assert.equal(d.data().actorUid, BORA)
  })

  it('수락한 사람 알림함에는 남기지 않는다 — 자기가 한 일이다', async () => {
    await notifyFriendAccepted(`${ANNA}_${BORA}`, ANNA, BORA)
    assert.equal((await db.collection(`notifications/${BORA}/items`).get()).size, 0)
  })

  it('같은 요청이 두 번 처리돼도 알림이 쌓이지 않는다', async () => {
    await notifyFriendAccepted(`${ANNA}_${BORA}`, ANNA, BORA)
    await notifyFriendAccepted(`${ANNA}_${BORA}`, ANNA, BORA)
    assert.equal((await db.collection(`notifications/${ANNA}/items`).get()).size, 1)
  })

  it('푸시가 실패해도 알림은 남는다', async () => {
    await db.doc(`users/${ANNA}/fcmTokens/t1`).set({ token: '가짜토큰' })
    await notifyFriendAccepted(`${ANNA}_${BORA}`, ANNA, BORA)
    assert.equal((await db.collection(`notifications/${ANNA}/items`).get()).size, 1)
  })
})
