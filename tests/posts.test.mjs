// 발행 콜러블 로직 테스트. Functions/Auth 에뮬레이터나 App Check 우회 없이,
// firebase-admin을 Firestore 에뮬레이터에 연결해 onCall 뒤의 handler 함수를 직접 부른다.
// (App Check는 onCall 래퍼의 관심사이지 handler의 관심사가 아니다.)
//   npm run test:rules   (rules.test.mjs와 같은 에뮬레이터 세션에서 함께 돈다)
// getDb는 handler와 같은 firebase-admin 인스턴스(같은 기본 앱)를 돌려준다.
// 루트에도 firebase-admin을 따로 설치해서 직접 import하면, functions/node_modules의
// firebase-admin과는 별개 모듈 인스턴스(별개 앱 레지스트리)가 되어 handler가 보는
// 데이터와 테스트가 심은 데이터가 서로 다른 곳을 가리키게 된다.
import { createPostHandler, getFriendFeedHandler, deletePostHandler, getDb } from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const ALICE = 'alice-p'
const BOB = 'bob-p'

let db

before(() => {
  db = getDb()
})

function assertHttpsCode(promise, code) {
  return assert.rejects(promise, (err) => err.code === code)
}

beforeEach(async () => {
  // 매 테스트 전에 ALICE의 독서 기록을 리셋한다.
  await db.doc(`reading-notes/${ALICE}`).set({
    books: [
      { id: 'b1', title: '공개된 책', author: '누군가', cover: '', status: 'reading', rating: 4, isPrivate: false },
      { id: 'b2', title: '비공개 책', author: '아무개', cover: '', status: 'done', rating: 5, isPrivate: true },
    ],
    quotes: [
      { id: 'q1', bookId: 'b1', text: '공개 책의 문장', highlights: [{ start: 0, end: 2 }] },
      { id: 'q2', bookId: 'b2', text: '비공개 책의 문장' },
      { id: 'q3', bookId: null, text: '책 연결 안 된 문장' },
    ],
    words: [],
    readingGoal: 10,
  })
})

describe('createPostHandler', () => {
  it('공개 책은 화이트리스트 필드만 담아 발행된다', async () => {
    const result = await createPostHandler(ALICE, { kind: 'book', refId: 'b1', caption: '이 책 좋아요' })
    assert.ok(result.id)
    const saved = (await db.doc(`posts/${result.id}`).get()).data()
    assert.equal(saved.authorUid, ALICE)
    assert.equal(saved.caption, '이 책 좋아요')
    assert.deepEqual(saved.attachment, {
      kind: 'book',
      bookTitle: '공개된 책',
      bookAuthor: '누군가',
      bookCover: '',
      bookStatus: 'reading',
      bookRating: 4,
    })
  })

  it('공개 책에 속한 인용구는 화이트리스트 필드만 담아 발행된다', async () => {
    const result = await createPostHandler(ALICE, { kind: 'quote', refId: 'q1', caption: '밑줄 쳤어요' })
    const saved = (await db.doc(`posts/${result.id}`).get()).data()
    assert.deepEqual(saved.attachment, {
      kind: 'quote',
      quoteText: '공개 책의 문장',
      quoteHighlights: [{ start: 0, end: 2 }],
      bookTitle: '공개된 책',
      bookAuthor: '누군가',
    })
  })

  it('책과 연결되지 않은 인용구도 발행된다', async () => {
    const result = await createPostHandler(ALICE, { kind: 'quote', refId: 'q3', caption: '단독 문장' })
    const saved = (await db.doc(`posts/${result.id}`).get()).data()
    assert.equal(saved.attachment.quoteText, '책 연결 안 된 문장')
    assert.equal(saved.attachment.bookTitle, null)
  })

  it('비공개 책은 발행이 거부된다', async () => {
    await assertHttpsCode(
      createPostHandler(ALICE, { kind: 'book', refId: 'b2', caption: '몰래 공유' }),
      'invalid-argument',
    )
  })

  it('비공개 책에 속한 인용구는 발행이 거부된다', async () => {
    await assertHttpsCode(
      createPostHandler(ALICE, { kind: 'quote', refId: 'q2', caption: '몰래 공유' }),
      'invalid-argument',
    )
  })

  it('caption이 없으면 거부된다', async () => {
    await assertHttpsCode(createPostHandler(ALICE, { kind: 'book', refId: 'b1', caption: '   ' }), 'invalid-argument')
  })

  it('caption이 300자를 넘으면 거부된다', async () => {
    await assertHttpsCode(
      createPostHandler(ALICE, { kind: 'book', refId: 'b1', caption: '가'.repeat(301) }),
      'invalid-argument',
    )
  })

  it('존재하지 않는 refId는 거부된다', async () => {
    await assertHttpsCode(
      createPostHandler(ALICE, { kind: 'book', refId: 'no-such-id', caption: '한마디' }),
      'invalid-argument',
    )
  })

  it('남의 uid로 호출해도 남의 책을 발행할 수 없다(본인 기록에서만 찾는다)', async () => {
    // BOB에게는 reading-notes 문서가 없으므로 무엇을 refId로 넘겨도 찾지 못해야 한다.
    await assertHttpsCode(
      createPostHandler(BOB, { kind: 'book', refId: 'b1', caption: '가로채기 시도' }),
      'invalid-argument',
    )
  })
})

describe('getFriendFeedHandler', () => {
  const DAVE = 'dave-p' // ALICE의 친구
  const EVE = 'eve-p' // 친구 아님

  beforeEach(async () => {
    await db.doc(`users/${ALICE}`).set({ email: 'alice@x.com', displayName: 'Alice', photoURL: 'alice.png' })
    await db.doc(`users/${DAVE}`).set({ email: 'dave@x.com', displayName: 'Dave', photoURL: 'dave.png' })
    await db.doc(`users/${EVE}`).set({ email: 'eve@x.com', displayName: 'Eve', photoURL: 'eve.png' })
    await db
      .doc(`friendRequests/${ALICE}_${DAVE}`)
      .set({ fromUid: ALICE, toUid: DAVE, status: 'accepted', createdAt: new Date().toISOString() })

    await db.collection('posts').add({
      authorUid: ALICE,
      createdAt: '2026-01-01T00:00:00.000Z',
      caption: '내 글',
      attachment: { kind: 'quote', quoteText: 'a' },
    })
    await db.collection('posts').add({
      authorUid: DAVE,
      createdAt: '2026-01-02T00:00:00.000Z',
      caption: '친구 글',
      attachment: { kind: 'quote', quoteText: 'd' },
    })
    await db.collection('posts').add({
      authorUid: EVE,
      createdAt: '2026-01-03T00:00:00.000Z',
      caption: '남남 글',
      attachment: { kind: 'quote', quoteText: 'e' },
    })
  })

  it('본인 글과 친구 글은 오고, 친구 아닌 사람 글은 오지 않는다', async () => {
    const posts = await getFriendFeedHandler(ALICE)
    const captions = posts.map((p) => p.caption)
    assert.ok(captions.includes('내 글'))
    assert.ok(captions.includes('친구 글'))
    assert.ok(!captions.includes('남남 글'))
  })

  it('최신순으로 정렬된다', async () => {
    const posts = await getFriendFeedHandler(ALICE)
    const createdAts = posts.map((p) => p.createdAt)
    const sorted = [...createdAts].sort().reverse()
    assert.deepEqual(createdAts, sorted)
  })

  it('작성자 표시정보(displayName)가 동봉된다', async () => {
    const posts = await getFriendFeedHandler(ALICE)
    const friendPost = posts.find((p) => p.caption === '친구 글')
    assert.equal(friendPost.authorDisplayName, 'Dave')
  })
})

describe('deletePostHandler', () => {
  it('작성자 본인은 자기 게시물을 삭제할 수 있다', async () => {
    const { id } = await createPostHandler(ALICE, { kind: 'book', refId: 'b1', caption: '지울 글' })
    await deletePostHandler(ALICE, id)
    const after = await db.doc(`posts/${id}`).get()
    assert.equal(after.exists, false)
  })

  it('다른 사람은 남의 게시물을 삭제할 수 없다', async () => {
    const { id } = await createPostHandler(ALICE, { kind: 'book', refId: 'b1', caption: '지우면 안 되는 글' })
    await assertHttpsCode(deletePostHandler(BOB, id), 'permission-denied')
    const after = await db.doc(`posts/${id}`).get()
    assert.equal(after.exists, true)
  })

  it('존재하지 않는 게시물을 지우려 하면 거부된다', async () => {
    await assertHttpsCode(deletePostHandler(ALICE, 'no-such-post'), 'not-found')
  })
})
