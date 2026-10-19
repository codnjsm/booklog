// 탈퇴 시 Firestore 정리 테스트. Auth 계정 삭제는 빼고 데이터 정리만 본다.
//   npm run test:rules
import { deleteUserDataHandler, getDb } from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const GONE = 'gone-d' // 탈퇴하는 사람
const FRIEND = 'friend-d' // 남아 있는 친구
const OTHER = 'other-d' // 또 다른 친구

let db

before(() => {
  db = getDb()
})

const MINE = [GONE, FRIEND, OTHER]

async function wipe() {
  for (const u of MINE) {
    for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
    for (const d of (await db.collection(`users/${u}/fcmTokens`).get()).docs) await d.ref.delete()
    await db.doc(`reading-notes/${u}`).delete()
    await db.doc(`users/${u}`).delete()
  }
  for (const coll of ['posts', 'recommendations']) {
    const byFrom = await db
      .collection(coll)
      .where(coll === 'posts' ? 'authorUid' : 'fromUid', 'in', MINE)
      .get()
    for (const d of byFrom.docs) await d.ref.delete()
  }
  for (const a of MINE) {
    for (const b of MINE) {
      if (a !== b) await db.doc(`friendRequests/${a}_${b}`).delete()
    }
  }
}

beforeEach(wipe)

async function exists(path) {
  return (await db.doc(path).get()).exists
}

describe('deleteUserData — 내 데이터', () => {
  it('내 서재·프로필·게시물·친구요청이 사라진다', async () => {
    await db.doc(`reading-notes/${GONE}`).set({ books: [] })
    await db.doc(`users/${GONE}`).set({ displayName: '탈퇴자' })
    await db.collection('posts').add({ authorUid: GONE, createdAt: '2026-01-01', caption: '글', likes: [] })
    await db.doc(`friendRequests/${GONE}_${FRIEND}`).set({ fromUid: GONE, toUid: FRIEND, status: 'accepted' })

    await deleteUserDataHandler(GONE)

    assert.equal(await exists(`reading-notes/${GONE}`), false)
    assert.equal(await exists(`users/${GONE}`), false)
    assert.equal(await exists(`friendRequests/${GONE}_${FRIEND}`), false)
    assert.equal((await db.collection('posts').where('authorUid', '==', GONE).get()).size, 0)
  })

  it('푸시 기기 토큰이 같이 지워진다 — 남겨두면 없는 사람 기기로 알림을 보내려 든다', async () => {
    await db.doc(`users/${GONE}/fcmTokens/t1`).set({ token: 't1' })
    await db.doc(`users/${GONE}/fcmTokens/t2`).set({ token: 't2' })
    await db.doc(`users/${FRIEND}/fcmTokens/t9`).set({ token: 't9' })

    await deleteUserDataHandler(GONE)

    assert.equal((await db.collection(`users/${GONE}/fcmTokens`).get()).size, 0)
    assert.equal((await db.collection(`users/${FRIEND}/fcmTokens`).get()).size, 1)
  })

  it('내 알림함이 비워진다', async () => {
    await db.doc(`notifications/${GONE}/items/like_p1_${FRIEND}`).set({ kind: 'like', actorUid: FRIEND })
    await db.doc(`notifications/${GONE}/items/recommend_r1`).set({ kind: 'recommend', actorUid: FRIEND })

    await deleteUserDataHandler(GONE)

    assert.equal((await db.collection(`notifications/${GONE}/items`).get()).size, 0)
  })

  it('남의 데이터는 건드리지 않는다', async () => {
    await db.doc(`reading-notes/${FRIEND}`).set({ books: [] })
    await db.doc(`users/${FRIEND}`).set({ displayName: '친구' })
    await db.doc(`friendRequests/${FRIEND}_${OTHER}`).set({ fromUid: FRIEND, toUid: OTHER, status: 'accepted' })
    await db.doc(`notifications/${FRIEND}/items/like_px_${OTHER}`).set({ kind: 'like', actorUid: OTHER })

    await deleteUserDataHandler(GONE)

    assert.equal(await exists(`reading-notes/${FRIEND}`), true)
    assert.equal(await exists(`users/${FRIEND}`), true)
    assert.equal(await exists(`friendRequests/${FRIEND}_${OTHER}`), true)
    assert.equal(await exists(`notifications/${FRIEND}/items/like_px_${OTHER}`), true)
  })
})

describe('deleteUserData — 남의 알림함에 내가 남긴 것', () => {
  it('내가 보낸 권유와 그 알림이 사라진다', async () => {
    const id = `${GONE}_${FRIEND}_b1`
    await db.doc(`recommendations/${id}`).set({ fromUid: GONE, toUid: FRIEND, status: 'pending', bookTitle: '책' })
    await db.doc(`notifications/${FRIEND}/items/recommend_${id}`).set({ kind: 'recommend', actorUid: GONE })

    await deleteUserDataHandler(GONE)

    assert.equal(await exists(`recommendations/${id}`), false)
    assert.equal(await exists(`notifications/${FRIEND}/items/recommend_${id}`), false)
  })

  it('내가 받은 권유와, 내가 담아서 보낸 알림이 사라진다', async () => {
    const id = `${FRIEND}_${GONE}_b2`
    await db.doc(`recommendations/${id}`).set({ fromUid: FRIEND, toUid: GONE, status: 'accepted', bookTitle: '책' })
    await db.doc(`notifications/${FRIEND}/items/recaccepted_${id}`).set({ kind: 'recommendAccepted', actorUid: GONE })

    await deleteUserDataHandler(GONE)

    assert.equal(await exists(`recommendations/${id}`), false)
    assert.equal(await exists(`notifications/${FRIEND}/items/recaccepted_${id}`), false)
  })

  it('내가 누른 좋아요가 거둬지고 그 알림도 사라진다', async () => {
    const ref = await db.collection('posts').add({
      authorUid: FRIEND,
      createdAt: '2026-01-01',
      caption: '친구 글',
      likes: [GONE, OTHER],
    })
    await db.doc(`notifications/${FRIEND}/items/like_${ref.id}_${GONE}`).set({ kind: 'like', actorUid: GONE })

    await deleteUserDataHandler(GONE)

    // 글 자체는 친구 것이므로 남고, 좋아요 수에서만 빠진다
    const after = await ref.get()
    assert.equal(after.exists, true)
    assert.deepEqual(after.data().likes, [OTHER])
    assert.equal(await exists(`notifications/${FRIEND}/items/like_${ref.id}_${GONE}`), false)
  })

  it('처리 안 된 권유만 있어도 터지지 않는다 — 없는 알림을 지우는 건 아무 일도 아니다', async () => {
    const id = `${FRIEND}_${GONE}_b3`
    await db.doc(`recommendations/${id}`).set({ fromUid: FRIEND, toUid: GONE, status: 'pending', bookTitle: '책' })

    await deleteUserDataHandler(GONE)

    assert.equal(await exists(`recommendations/${id}`), false)
  })

  it('지운 개수를 돌려준다', async () => {
    await db.collection('posts').add({ authorUid: GONE, createdAt: '2026-01-01', caption: '글', likes: [] })
    await db.doc(`friendRequests/${GONE}_${FRIEND}`).set({ fromUid: GONE, toUid: FRIEND, status: 'accepted' })
    await db.doc(`notifications/${GONE}/items/n1`).set({ kind: 'like', actorUid: FRIEND })
    await db
      .doc(`recommendations/${GONE}_${FRIEND}_b9`)
      .set({ fromUid: GONE, toUid: FRIEND, status: 'pending', bookTitle: '책' })
    await db.collection('posts').add({ authorUid: FRIEND, createdAt: '2026-01-01', caption: '친구 글', likes: [GONE] })

    await db.doc(`users/${GONE}/fcmTokens/t1`).set({ token: 't1' })

    const r = await deleteUserDataHandler(GONE)

    assert.equal(r.fcmTokens, 1)
    assert.equal(r.posts, 1)
    assert.equal(r.friendRequests, 1)
    assert.equal(r.recommendations, 1)
    assert.equal(r.likes, 1)
    // 내 알림함 1건 + 권유 알림 1건 + 좋아요 알림 1건
    assert.equal(r.notifications, 3)
  })
})

describe('deleteUserData — 아무것도 없을 때', () => {
  it('데이터가 하나도 없어도 터지지 않는다', async () => {
    const r = await deleteUserDataHandler(GONE)
    assert.deepEqual(r, { posts: 0, friendRequests: 0, notifications: 0, recommendations: 0, likes: 0, fcmTokens: 0 })
  })
})
