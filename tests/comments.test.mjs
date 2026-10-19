// 댓글 테스트. 권한과 알림 묶기가 핵심이다.
//   npm run test:rules
import { addCommentHandler, deleteCommentHandler, getCommentsHandler, getDb } from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const YUN = 'yun-cm' // 글쓴이
const DAN = 'dan-cm' // YUN의 친구
const OH = 'oh-cm' // 친구 아님

let db
const MINE = [YUN, DAN, OH]

before(() => {
  db = getDb()
})

function assertCode(promise, code) {
  return assert.rejects(promise, (err) => err.code === code)
}

async function makePost(authorUid) {
  const ref = await db.collection('posts').add({ authorUid, createdAt: '2026-10-19', caption: '글', likes: [] })
  return ref.id
}

const commentsOf = async (postId) => (await db.collection(`posts/${postId}/comments`).get()).docs
const countOf = async (postId) => (await db.doc(`posts/${postId}`).get()).data().commentCount ?? 0
const notisOf = async (uid) =>
  (await db.collection(`notifications/${uid}/items`).get()).docs.map((d) => ({ id: d.id, ...d.data() }))

beforeEach(async () => {
  for (const d of (await db.collection('posts').where('authorUid', 'in', MINE).get()).docs) {
    for (const c of (await d.ref.collection('comments').get()).docs) await c.ref.delete()
    await d.ref.delete()
  }
  for (const u of MINE) {
    for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
    await db.doc(`users/${u}`).set({ displayName: u.toUpperCase(), photoURL: '' })
  }
  for (const a of MINE) for (const b of MINE) if (a !== b) await db.doc(`friendRequests/${a}_${b}`).delete()
  await db.doc(`friendRequests/${YUN}_${DAN}`).set({ fromUid: YUN, toUid: DAN, status: 'accepted' })
})

describe('addComment', () => {
  it('친구 글에 댓글을 쓸 수 있고 수가 늘어난다', async () => {
    const post = await makePost(YUN)
    const { id } = await addCommentHandler(DAN, { postId: post, text: '좋네요' })

    const cs = await commentsOf(post)
    assert.equal(cs.length, 1)
    assert.equal(cs[0].id, id)
    assert.equal(cs[0].data().text, '좋네요')
    assert.equal(cs[0].data().authorUid, DAN)
    assert.equal(await countOf(post), 1)
  })

  it('내 글에도 쓸 수 있다', async () => {
    const post = await makePost(YUN)
    await addCommentHandler(YUN, { postId: post, text: '덧붙임' })
    assert.equal(await countOf(post), 1)
  })

  it('친구가 아닌 사람의 글에는 쓸 수 없다', async () => {
    const post = await makePost(YUN)
    await assertCode(addCommentHandler(OH, { postId: post, text: '안녕' }), 'permission-denied')
  })

  it('빈 댓글은 거부된다', async () => {
    const post = await makePost(YUN)
    await assertCode(addCommentHandler(DAN, { postId: post, text: '   ' }), 'invalid-argument')
  })

  it('300자를 넘으면 거부된다', async () => {
    const post = await makePost(YUN)
    await assertCode(addCommentHandler(DAN, { postId: post, text: '가'.repeat(301) }), 'invalid-argument')
  })

  it('없는 게시물이면 거부된다', async () => {
    await assertCode(addCommentHandler(DAN, { postId: '없음', text: '안녕' }), 'not-found')
  })
})

describe('deleteComment — 권한', () => {
  it('쓴 사람은 자기 댓글을 지운다', async () => {
    const post = await makePost(YUN)
    const { id } = await addCommentHandler(DAN, { postId: post, text: '좋네요' })

    await deleteCommentHandler(DAN, { postId: post, commentId: id })

    assert.equal((await commentsOf(post)).length, 0)
    assert.equal(await countOf(post), 0)
  })

  it('글쓴이는 남의 댓글도 지운다 — 신고 체계가 없으니 유일한 수단이다', async () => {
    const post = await makePost(YUN)
    const { id } = await addCommentHandler(DAN, { postId: post, text: '불쾌한 말' })

    await deleteCommentHandler(YUN, { postId: post, commentId: id })

    assert.equal((await commentsOf(post)).length, 0)
  })

  it('남의 글에 달린 남의 댓글은 못 지운다', async () => {
    const post = await makePost(YUN)
    const { id } = await addCommentHandler(YUN, { postId: post, text: '내 글 내 댓글' })

    await assertCode(deleteCommentHandler(DAN, { postId: post, commentId: id }), 'permission-denied')
  })

  it('없는 댓글은 거부된다', async () => {
    const post = await makePost(YUN)
    await assertCode(deleteCommentHandler(YUN, { postId: post, commentId: '없음' }), 'not-found')
  })
})

describe('getComments', () => {
  it('오래된 순으로 온다 — 대화 순서', async () => {
    const post = await makePost(YUN)
    await addCommentHandler(DAN, { postId: post, text: '첫째' })
    await new Promise((r) => setTimeout(r, 15))
    await addCommentHandler(YUN, { postId: post, text: '둘째' })

    const list = await getCommentsHandler(YUN, { postId: post })

    assert.deepEqual(
      list.map((c) => c.text),
      ['첫째', '둘째'],
    )
    assert.equal(list[0].authorDisplayName, DAN.toUpperCase())
  })

  it('내가 볼 수 없는 게시물의 댓글은 거부된다', async () => {
    const post = await makePost(YUN)
    await assertCode(getCommentsHandler(OH, { postId: post }), 'permission-denied')
  })

  it('탈퇴한 사람의 댓글은 빠진다', async () => {
    const post = await makePost(YUN)
    await addCommentHandler(DAN, { postId: post, text: '사라질 댓글' })
    await addCommentHandler(YUN, { postId: post, text: '남을 댓글' })
    await db.doc(`users/${DAN}`).delete()

    const list = await getCommentsHandler(YUN, { postId: post })

    assert.deepEqual(
      list.map((c) => c.text),
      ['남을 댓글'],
    )
  })

  it('댓글이 없으면 빈 목록', async () => {
    const post = await makePost(YUN)
    assert.deepEqual(await getCommentsHandler(YUN, { postId: post }), [])
  })
})

describe('댓글 알림 묶기', () => {
  it('댓글이 달리면 글쓴이에게 알림이 간다', async () => {
    const post = await makePost(YUN)
    await addCommentHandler(DAN, { postId: post, text: '좋네요' })

    const n = await notisOf(YUN)
    assert.equal(n.length, 1)
    assert.equal(n[0].kind, 'comment')
    assert.equal(n[0].id, `comment_${post}`)
    assert.equal(n[0].count, 1)
    assert.equal(n[0].postId, post)
  })

  it('같은 글에 여러 개 달려도 알림은 하나 — 수만 올라간다', async () => {
    const post = await makePost(YUN)
    await addCommentHandler(DAN, { postId: post, text: '하나' })
    await addCommentHandler(DAN, { postId: post, text: '둘' })
    await addCommentHandler(DAN, { postId: post, text: '셋' })

    const n = await notisOf(YUN)
    assert.equal(n.length, 1)
    assert.equal(n[0].count, 3)
  })

  it('내 글에 내가 쓰면 알림이 가지 않는다', async () => {
    const post = await makePost(YUN)
    await addCommentHandler(YUN, { postId: post, text: '덧붙임' })
    assert.deepEqual(await notisOf(YUN), [])
  })

  it('댓글을 지워도 알림은 남는다 — 이미 달렸던 사실은 되돌리지 않는다', async () => {
    const post = await makePost(YUN)
    const { id } = await addCommentHandler(DAN, { postId: post, text: '좋네요' })
    await deleteCommentHandler(DAN, { postId: post, commentId: id })

    assert.equal((await notisOf(YUN)).length, 1)
  })
})

describe('게시물을 지우면 댓글도 사라진다', () => {
  it('하위 컬렉션은 저절로 안 지워지므로 같이 치운다', async () => {
    const { deletePostHandler } = await import('../functions/lib/index.js')
    const post = await makePost(YUN)
    await addCommentHandler(DAN, { postId: post, text: '댓글' })

    await deletePostHandler(YUN, post)

    assert.equal((await db.doc(`posts/${post}`).get()).exists, false)
    assert.equal((await db.collection(`posts/${post}/comments`).get()).size, 0)
  })
})
