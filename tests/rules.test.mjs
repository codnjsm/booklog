// Firestore 보안 규칙 테스트. 에뮬레이터 위에서 돈다.
//   npm run test:rules
//
// 규칙 실수는 화면에 아무 증상이 없다 — 친구에게 문서 전체 읽기를 허용해두고도
// UI가 멀쩡해 보여서 한참 몰랐던 적이 있다. 그래서 규칙은 눈이 아니라 테스트로 지킨다.
import { readFileSync } from 'node:fs'
import { after, before, describe, it } from 'node:test'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, addDoc, getDoc, getDocs, setDoc } from 'firebase/firestore'

const ALICE = 'alice'
const BOB = 'bob' // ALICE의 친구
const CAROL = 'carol' // 남남

let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'booklog-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })

  // 규칙을 우회해서 사전 데이터를 심는다.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    // ALICE와 BOB은 수락된 친구
    await setDoc(doc(db, 'friendRequests', `${ALICE}_${BOB}`), {
      fromUid: ALICE,
      toUid: BOB,
      status: 'accepted',
      createdAt: new Date().toISOString(),
    })
    // ALICE의 독서 기록 (공개 책 1권 + 비공개 책 1권 + 인용구)
    await setDoc(doc(db, 'reading-notes', ALICE), {
      books: [
        { id: 'b1', title: '공개된 책', isPrivate: false },
        { id: 'b2', title: '비공개 책', isPrivate: true },
      ],
      quotes: [{ id: 'q1', text: '사적인 인용구' }],
      words: [],
      readingGoal: 30,
    })
    // 이미 존재하는 게시물 하나 (직접 읽기 차단 테스트용)
    await setDoc(doc(db, 'posts', 'p1'), {
      authorUid: ALICE,
      createdAt: new Date().toISOString(),
      caption: '좋은 문장이었어요',
      attachment: { kind: 'quote', quoteText: '사적인 인용구' },
    })
  })
})

after(async () => {
  await testEnv?.cleanup()
})

describe('reading-notes 읽기 권한', () => {
  it('본인은 자기 독서 기록을 읽는다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(getDoc(doc(db, 'reading-notes', ALICE)))
  })

  // 이 테스트가 이번 작업의 핵심이다.
  // 친구에게 문서 전체를 열어주면 비공개 책과 인용구까지 딸려 나간다.
  // 공개 범위는 콜러블 함수가 서버에서 골라 주므로, 규칙은 직접 읽기를 막아야 한다.
  it('친구여도 남의 독서 기록을 직접 읽지 못한다', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore()
    await assertFails(getDoc(doc(db, 'reading-notes', ALICE)))
  })

  it('친구가 아니면 남의 독서 기록을 읽지 못한다', async () => {
    const db = testEnv.authenticatedContext(CAROL).firestore()
    await assertFails(getDoc(doc(db, 'reading-notes', ALICE)))
  })

  it('로그인하지 않으면 읽지 못한다', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'reading-notes', ALICE)))
  })
})

describe('posts 직접 접근 차단', () => {
  // 게시물은 createPost/getFriendFeed/deletePost 콜러블을 통해서만 만들고 읽고 지운다.
  // 클라이언트가 직접 만지면 스냅샷 화이트리스트를 우회할 수 있으므로 전면 차단한다.
  it('친구여도 게시물을 클라이언트로 직접 읽지 못한다', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore()
    await assertFails(getDoc(doc(db, 'posts', 'p1')))
  })

  it('작성자 본인도 게시물을 클라이언트로 직접 읽지 못한다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(getDoc(doc(db, 'posts', 'p1')))
  })

  it('로그인한 사용자도 게시물 목록을 클라이언트로 직접 조회하지 못한다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(getDocs(collection(db, 'posts')))
  })

  it('게시물을 클라이언트로 직접 쓰지 못한다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(
      addDoc(collection(db, 'posts'), {
        authorUid: ALICE,
        createdAt: new Date().toISOString(),
        caption: '직접 써봄',
        attachment: { kind: 'quote', quoteText: '아무거나' },
      }),
    )
  })
})

describe('challenges 직접 접근 차단', () => {
  before(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'challenges', 'c1'), {
        ownerUid: ALICE,
        from: '2026-10-01',
        to: '2026-10-31',
        goalDays: 10,
        members: [ALICE],
        invited: [BOB],
      })
    })
  })

  it('참여자도 직접 읽지 못한다 — 콜러블로만 본다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(getDoc(doc(db, 'challenges', 'c1')))
  })

  it('직접 만들지 못한다 — 남의 챌린지에 자기를 끼워 넣을 수 있다', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore()
    await assertFails(setDoc(doc(db, 'challenges', 'evil'), { ownerUid: BOB, members: [BOB] }))
  })

  it('목표를 낮추지 못한다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(setDoc(doc(db, 'challenges', 'c1'), { goalDays: 1 }, { merge: true }))
  })
})

describe('fcmTokens 접근 제어', () => {
  before(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users', ALICE, 'fcmTokens', 't1'), { token: 't1', updatedAt: '2026-10-19' })
    })
  })

  it('본인은 자기 기기 토큰을 읽고 쓴다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(getDocs(collection(db, 'users', ALICE, 'fcmTokens')))
    await assertSucceeds(setDoc(doc(db, 'users', ALICE, 'fcmTokens', 't2'), { token: 't2' }))
  })

  it('친구여도 남의 토큰은 읽지 못한다 — users 문서는 읽히지만 하위 컬렉션은 아니다', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore()
    await assertSucceeds(getDoc(doc(db, 'users', ALICE)))
    await assertFails(getDoc(doc(db, 'users', ALICE, 'fcmTokens', 't1')))
    await assertFails(getDocs(collection(db, 'users', ALICE, 'fcmTokens')))
  })

  it('남남은 더더욱 읽지 못한다', async () => {
    const db = testEnv.authenticatedContext(CAROL).firestore()
    await assertFails(getDoc(doc(db, 'users', ALICE, 'fcmTokens', 't1')))
  })

  it('남의 토큰 자리에 쓰지 못한다 — 남의 기기로 알림을 보내게 만들 수 있다', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore()
    await assertFails(setDoc(doc(db, 'users', ALICE, 'fcmTokens', 'evil'), { token: 'evil' }))
  })

  it('로그인하지 않으면 읽지도 쓰지도 못한다', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users', ALICE, 'fcmTokens', 't1')))
    await assertFails(setDoc(doc(db, 'users', ALICE, 'fcmTokens', 'x'), { token: 'x' }))
  })
})

describe('notifications 접근 제어', () => {
  before(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'notifications', ALICE, 'items', 'n1'), {
        kind: 'like',
        actorUid: BOB,
        postId: 'p1',
        createdAt: '2026-10-13T00:00:00.000Z',
      })
    })
  })

  it('본인은 자기 알림을 읽는다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(getDocs(collection(db, 'notifications', ALICE, 'items')))
  })

  it('남의 알림은 읽지 못한다 — 누가 누구 글에 반응했는지 들여다볼 수 있다', async () => {
    const db = testEnv.authenticatedContext(CAROL).firestore()
    await assertFails(getDocs(collection(db, 'notifications', ALICE, 'items')))
  })

  it('친구여도 남의 알림은 읽지 못한다', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore()
    await assertFails(getDoc(doc(db, 'notifications', ALICE, 'items', 'n1')))
  })

  it('로그인하지 않으면 읽지 못한다', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'notifications', ALICE, 'items', 'n1')))
  })

  it('알림을 클라이언트가 직접 쓰지 못한다 — 서버만 만든다', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(setDoc(doc(db, 'notifications', ALICE, 'items', 'fake'), { kind: 'like' }))
  })

  it('남의 알림을 지우지 못한다', async () => {
    const db = testEnv.authenticatedContext(CAROL).firestore()
    await assertFails(setDoc(doc(db, 'notifications', ALICE, 'items', 'n1'), { kind: 'x' }))
  })
})
