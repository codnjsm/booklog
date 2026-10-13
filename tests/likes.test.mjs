// 좋아요 콜러블 로직 테스트. posts.test.mjs와 같은 방식으로 handler를 직접 부른다.
//   npm run test:rules
import { toggleLikeHandler, getPostLikesHandler, getDb } from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const ALICE = 'alice-l' // 글쓴이
const BOB = 'bob-l' // ALICE의 친구
const CAROL = 'carol-l' // ALICE의 친구가 아님

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

async function makePost(authorUid, likes = []) {
  const ref = await db.collection('posts').add({
    authorUid,
    createdAt: new Date().toISOString(),
    caption: '테스트 글',
    attachment: { type: 'quote', text: '문장' },
    likes,
  })
  return ref.id
}

// 다른 테스트 파일과 같은 에뮬레이터 세션을 쓰므로, 이 파일이 만든 것만 지운다.
// 컬렉션을 통째로 비우면 posts.test.mjs가 심어둔 데이터까지 날아간다.
const MINE = [ALICE, BOB, CAROL, 'dave-l']

beforeEach(async () => {
  const posts = await db.collection('posts').where('authorUid', 'in', MINE).get()
  for (const d of posts.docs) await d.ref.delete()
  for (const u of MINE) {
    for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
  }
  for (const a of MINE) {
    for (const b of MINE) {
      if (a !== b) await db.doc(`friendRequests/${a}_${b}`).delete()
    }
  }
  await makeFriends(ALICE, BOB)
})

describe('toggleLike', () => {
  it('처음 누르면 추가된다', async () => {
    const id = await makePost(ALICE)
    const r = await toggleLikeHandler(BOB, id)
    assert.equal(r.liked, true)
    assert.equal(r.count, 1)
    const snap = await db.doc(`posts/${id}`).get()
    assert.deepEqual(snap.data().likes, [BOB])
  })

  it('다시 누르면 취소된다', async () => {
    const id = await makePost(ALICE, [BOB])
    const r = await toggleLikeHandler(BOB, id)
    assert.equal(r.liked, false)
    assert.equal(r.count, 0)
    const snap = await db.doc(`posts/${id}`).get()
    assert.deepEqual(snap.data().likes, [])
  })

  it('같은 사람이 두 번 눌러도 중복되지 않는다', async () => {
    const id = await makePost(ALICE)
    await toggleLikeHandler(BOB, id)
    await toggleLikeHandler(BOB, id) // 취소
    await toggleLikeHandler(BOB, id) // 다시 추가
    const snap = await db.doc(`posts/${id}`).get()
    assert.deepEqual(snap.data().likes, [BOB])
  })

  it('내 글에 내가 누르는 것은 허용된다', async () => {
    const id = await makePost(ALICE)
    const r = await toggleLikeHandler(ALICE, id)
    assert.equal(r.liked, true)
  })

  it('친구가 아닌 사람의 게시물에는 누를 수 없다', async () => {
    const id = await makePost(ALICE)
    await assertHttpsCode(toggleLikeHandler(CAROL, id), 'permission-denied')
  })

  it('없는 게시물이면 거부된다', async () => {
    await assertHttpsCode(toggleLikeHandler(BOB, 'no-such-post'), 'not-found')
  })

  it('게시물 id가 비어 있으면 거부된다', async () => {
    await assertHttpsCode(toggleLikeHandler(BOB, ''), 'invalid-argument')
    await assertHttpsCode(toggleLikeHandler(BOB, undefined), 'invalid-argument')
  })

  it('여러 사람이 누르면 모두 쌓인다', async () => {
    await makeFriends(ALICE, CAROL)
    const id = await makePost(ALICE)
    await toggleLikeHandler(BOB, id)
    const r = await toggleLikeHandler(CAROL, id)
    assert.equal(r.count, 2)
    const snap = await db.doc(`posts/${id}`).get()
    assert.deepEqual(snap.data().likes.sort(), [BOB, CAROL].sort())
  })
})

const notifs = async (uid) => (await db.collection(`notifications/${uid}/items`).get()).docs.map((d) => d.data())

describe('toggleLike — 알림', () => {
  it('남의 글에 좋아요를 누르면 글쓴이에게 알림이 생긴다', async () => {
    const id = await makePost(ALICE)
    await toggleLikeHandler(BOB, id)
    const items = await notifs(ALICE)
    assert.equal(items.length, 1)
    assert.equal(items[0].kind, 'like')
    assert.equal(items[0].actorUid, BOB)
    assert.equal(items[0].postId, id)
  })

  it('내 글에 내가 누르면 알림을 만들지 않는다', async () => {
    const id = await makePost(ALICE)
    await toggleLikeHandler(ALICE, id)
    assert.equal((await notifs(ALICE)).length, 0)
  })

  it('좋아요를 취소하면 알림도 거둔다', async () => {
    const id = await makePost(ALICE)
    await toggleLikeHandler(BOB, id)
    await toggleLikeHandler(BOB, id)
    assert.equal((await notifs(ALICE)).length, 0)
  })

  it('눌렀다 취소하기를 반복해도 알림이 쌓이지 않는다', async () => {
    const id = await makePost(ALICE)
    for (let i = 0; i < 3; i++) {
      await toggleLikeHandler(BOB, id)
      await toggleLikeHandler(BOB, id)
    }
    await toggleLikeHandler(BOB, id)
    assert.equal((await notifs(ALICE)).length, 1)
  })

  it('누른 사람이 여럿이면 알림도 각각 생긴다', async () => {
    await makeFriends(ALICE, CAROL)
    const id = await makePost(ALICE)
    await toggleLikeHandler(BOB, id)
    await toggleLikeHandler(CAROL, id)
    assert.equal((await notifs(ALICE)).length, 2)
  })

  it('누른 사람에게는 알림이 가지 않는다', async () => {
    const id = await makePost(ALICE)
    await toggleLikeHandler(BOB, id)
    assert.equal((await notifs(BOB)).length, 0)
  })
})

const DAVE = 'dave-l' // ALICE의 친구지만 BOB과는 남남

async function setProfile(uid, name) {
  await db.doc(`users/${uid}`).set({ uid, email: `${uid}@example.com`, displayName: name, photoURL: '' })
}

describe('getPostLikes — 누른 사람 목록', () => {
  it('아무도 안 눌렀으면 빈 목록', async () => {
    const id = await makePost(ALICE)
    assert.deepEqual(await getPostLikesHandler(BOB, id), [])
  })

  it('내 친구는 이름이 내려온다', async () => {
    await setProfile(BOB, '밥')
    const id = await makePost(ALICE, [BOB])
    const list = await getPostLikesHandler(ALICE, id)
    assert.equal(list.length, 1)
    assert.equal(list[0].known, true)
    assert.equal(list[0].displayName, '밥')
  })

  it('친구가 아닌 사람은 이름도 사진도 내려오지 않는다', async () => {
    await makeFriends(ALICE, DAVE)
    await setProfile(DAVE, '데이브')
    // BOB이 보는 상황: DAVE는 ALICE의 친구지만 BOB과는 남남이다
    const id = await makePost(ALICE, [DAVE])
    const list = await getPostLikesHandler(BOB, id)
    assert.equal(list.length, 1)
    assert.equal(list[0].known, false)
    assert.equal(list[0].displayName, '')
    // 응답 어디에도 이름이 없어야 한다 — 화면이 아니라 데이터에서 막는다
    assert.ok(!JSON.stringify(list).includes('데이브'))
    assert.ok(!JSON.stringify(list).includes(DAVE))
  })

  it('내 친구가 위, 모르는 사람이 아래로 정렬된다', async () => {
    await makeFriends(ALICE, DAVE)
    await setProfile(BOB, '밥')
    const id = await makePost(ALICE, [DAVE, BOB])
    const list = await getPostLikesHandler(BOB, id)
    assert.deepEqual(
      list.map((x) => x.known),
      [true, false],
    )
  })

  it('내가 볼 수 없는 게시물의 목록은 거부된다', async () => {
    const id = await makePost(ALICE, [BOB])
    await assertHttpsCode(getPostLikesHandler(CAROL, id), 'permission-denied')
  })

  it('없는 게시물이면 거부된다', async () => {
    await assertHttpsCode(getPostLikesHandler(BOB, 'no-such'), 'not-found')
  })

  it('게시물 id가 비어 있으면 거부된다', async () => {
    await assertHttpsCode(getPostLikesHandler(BOB, ''), 'invalid-argument')
  })
})
