// 독서 챌린지 — 날짜 세기 테스트.
// 서버가 직접 세는 부분이라 숫자가 틀리면 겨루기 자체가 망가진다.
//   npm run test:rules
import { countRecordedDays } from '../functions/lib/index.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const FROM = '2026-10-01'
const TO = '2026-10-31'

const book = (over = {}) => ({ createdAt: '2026-10-05T00:00:00.000Z', ...over })

describe('countRecordedDays — 기간 안에 기록한 날 수', () => {
  it('책을 담은 날을 센다', () => {
    assert.equal(countRecordedDays({ books: [book()] }, FROM, TO), 1)
  })

  it('완독한 날도 센다', () => {
    assert.equal(countRecordedDays({ books: [book({ finishedAt: '2026-10-09T00:00:00.000Z' })] }, FROM, TO), 2)
  })

  it('달력에 고른 읽은 날도 센다', () => {
    const notes = { books: [book({ readDates: ['2026-10-06', '2026-10-07'] })] }
    assert.equal(countRecordedDays(notes, FROM, TO), 3)
  })

  it('문장과 단어를 저장한 날도 센다', () => {
    const notes = {
      books: [],
      quotes: [{ createdAt: '2026-10-11T00:00:00.000Z' }],
      words: [{ createdAt: '2026-10-12T00:00:00.000Z' }],
    }
    assert.equal(countRecordedDays(notes, FROM, TO), 2)
  })

  it('하루에 여러 번 기록해도 하루로 센다', () => {
    // 서울 기준 2026-10-05 안에 들어오는 시각들 (UTC로는 10-04 15:00 ~ 10-05 14:59)
    const notes = {
      books: [book({ createdAt: '2026-10-04T16:00:00.000Z', readDates: ['2026-10-05'] })],
      quotes: [{ createdAt: '2026-10-05T14:00:00.000Z' }],
      words: [{ createdAt: '2026-10-05T03:00:00.000Z' }],
    }
    assert.equal(countRecordedDays(notes, FROM, TO), 1)
  })

  it('서울 기준으로 센다 — UTC로 자르면 전날이 되는 시각도 제 날로 센다', () => {
    // UTC 2026-10-04 20:00 = 서울 2026-10-05 05:00. 그냥 잘랐다면 기간 밖(9월 아님, 10-04)이었다.
    assert.equal(countRecordedDays({ books: [{ createdAt: '2026-10-04T20:00:00.000Z' }] }, '2026-10-05', TO), 1)
  })

  it('기간 밖은 세지 않는다', () => {
    const notes = {
      books: [book({ createdAt: '2026-09-30T10:00:00.000Z', readDates: ['2026-11-01'] })],
    }
    assert.equal(countRecordedDays(notes, FROM, TO), 0)
  })

  it('기간 경계는 양쪽 다 포함한다', () => {
    const notes = { books: [book({ createdAt: '2026-10-01T00:00:00.000Z', readDates: ['2026-10-31'] })] }
    assert.equal(countRecordedDays(notes, FROM, TO), 2)
  })

  it('기록이 없으면 0', () => {
    assert.equal(countRecordedDays({ books: [], quotes: [], words: [] }, FROM, TO), 0)
  })

  it('문서가 아예 없어도 0 — 가입만 하고 안 쓴 사람', () => {
    assert.equal(countRecordedDays(undefined, FROM, TO), 0)
  })

  it('값이 깨져 있어도 터지지 않는다', () => {
    const notes = {
      books: [{ createdAt: null, finishedAt: 123, readDates: '배열아님' }, {}],
      quotes: [{ createdAt: undefined }],
      words: [{}],
    }
    assert.equal(countRecordedDays(notes, FROM, TO), 0)
  })

  it('날짜 배열 안에 이상한 값이 섞여도 멀쩡한 것만 센다', () => {
    const notes = { books: [{ readDates: ['2026-10-03', null, 42, '', '2026-10-04'] }] }
    assert.equal(countRecordedDays(notes, FROM, TO), 2)
  })
})

// ── 만들기·참여 ──────────────────────────────────────────────
import {
  createChallengeHandler,
  inviteToChallengeHandler,
  joinChallengeHandler,
  declineChallengeHandler,
  deleteChallengeHandler,
  isDayString,
  daysInclusive,
  todayInSeoul,
  getDb,
} from '../functions/lib/index.js'
import { before, beforeEach } from 'node:test'

const HAN = 'han-c' // 방장
const SEO = 'seo-c' // HAN의 친구
const MIN = 'min-c' // HAN의 친구
const NAM = 'nam-c' // 친구 아님

let db
const MINE = [HAN, SEO, MIN, NAM]

before(() => {
  db = getDb()
})

function assertCode(promise, code) {
  return assert.rejects(promise, (err) => err.code === code)
}

async function makeFriends(a, b) {
  await db.doc(`friendRequests/${a}_${b}`).set({ fromUid: a, toUid: b, status: 'accepted', createdAt: '2026-01-01' })
}

/** 오늘을 포함하는 안전한 기간 — 테스트가 날짜에 따라 깨지지 않게 한다. */
function period(days = 10) {
  const today = todayInSeoul()
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + (days - 1) * 86400000).toISOString().slice(0, 10)
  return { from: today, to: end }
}

beforeEach(async () => {
  for (const d of (await db.collection('challenges').where('ownerUid', 'in', MINE).get()).docs) await d.ref.delete()
  for (const a of MINE) for (const b of MINE) if (a !== b) await db.doc(`friendRequests/${a}_${b}`).delete()
  await makeFriends(HAN, SEO)
  await makeFriends(HAN, MIN)
})

describe('isDayString / daysInclusive — 기간 계산', () => {
  it('형식이 맞고 실제 있는 날짜만 받는다', () => {
    assert.equal(isDayString('2026-10-01'), true)
    assert.equal(isDayString('2026-13-01'), false)
    assert.equal(isDayString('2026-02-30'), false)
    assert.equal(isDayString('2026-10-1'), false)
    assert.equal(isDayString(20261001), false)
  })

  it('양끝을 포함해서 센다', () => {
    assert.equal(daysInclusive('2026-10-01', '2026-10-01'), 1)
    assert.equal(daysInclusive('2026-10-01', '2026-10-03'), 3)
    assert.equal(daysInclusive('2026-10-01', '2026-10-31'), 31)
  })
})

describe('createChallenge', () => {
  it('만들면 방장이 참여자로 들어간다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 5, invite: [SEO] })

    const c = (await db.doc(`challenges/${id}`).get()).data()
    assert.equal(c.ownerUid, HAN)
    assert.deepEqual(c.members, [HAN])
    assert.deepEqual(c.invited, [SEO])
    assert.equal(c.goalDays, 5)
  })

  it('친구가 아닌 사람은 부를 수 없다', async () => {
    const { from, to } = period()
    await assertCode(createChallengeHandler(HAN, { from, to, goalDays: 5, invite: [NAM] }), 'permission-denied')
  })

  it('같은 사람을 두 번 적어도 한 번만 들어간다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 5, invite: [SEO, SEO] })
    assert.deepEqual((await db.doc(`challenges/${id}`).get()).data().invited, [SEO])
  })

  it('목표가 기간보다 크면 거부된다', async () => {
    const { from, to } = period(10)
    await assertCode(createChallengeHandler(HAN, { from, to, goalDays: 11 }), 'invalid-argument')
  })

  it('목표가 0 이하면 거부된다', async () => {
    const { from, to } = period()
    await assertCode(createChallengeHandler(HAN, { from, to, goalDays: 0 }), 'invalid-argument')
  })

  it('기간이 거꾸로면 거부된다', async () => {
    await assertCode(
      createChallengeHandler(HAN, { from: '2026-10-10', to: '2026-10-01', goalDays: 3 }),
      'invalid-argument',
    )
  })

  it('기간이 한 달을 넘으면 거부된다', async () => {
    const { from } = period()
    const to = new Date(Date.parse(`${from}T00:00:00Z`) + 40 * 86400000).toISOString().slice(0, 10)
    await assertCode(createChallengeHandler(HAN, { from, to, goalDays: 3 }), 'invalid-argument')
  })

  it('이미 지난 기간으로는 만들 수 없다', async () => {
    await assertCode(
      createChallengeHandler(HAN, { from: '2020-01-01', to: '2020-01-10', goalDays: 3 }),
      'invalid-argument',
    )
  })

  it('20명을 넘겨 부를 수 없다', async () => {
    const { from, to } = period()
    const many = Array.from({ length: 20 }, (_, i) => 'x' + i)
    await assertCode(createChallengeHandler(HAN, { from, to, goalDays: 3, invite: many }), 'invalid-argument')
  })
})

describe('inviteToChallenge / joinChallenge', () => {
  async function made() {
    const { from, to } = period()
    return (await createChallengeHandler(HAN, { from, to, goalDays: 5, invite: [SEO] })).id
  }

  it('방장만 부를 수 있다', async () => {
    const id = await made()
    await assertCode(inviteToChallengeHandler(SEO, { challengeId: id, toUid: MIN }), 'permission-denied')
    await inviteToChallengeHandler(HAN, { challengeId: id, toUid: MIN })
    assert.deepEqual((await db.doc(`challenges/${id}`).get()).data().invited.sort(), [MIN, SEO].sort())
  })

  it('같은 사람을 두 번 불러도 쌓이지 않는다', async () => {
    const id = await made()
    await inviteToChallengeHandler(HAN, { challengeId: id, toUid: MIN })
    await inviteToChallengeHandler(HAN, { challengeId: id, toUid: MIN })
    assert.equal((await db.doc(`challenges/${id}`).get()).data().invited.length, 2)
  })

  it('초대받은 사람만 참여할 수 있다', async () => {
    const id = await made()
    await assertCode(joinChallengeHandler(MIN, { challengeId: id }), 'permission-denied')
    await joinChallengeHandler(SEO, { challengeId: id })
    const c = (await db.doc(`challenges/${id}`).get()).data()
    assert.deepEqual(c.members.sort(), [HAN, SEO].sort())
    assert.deepEqual(c.invited, [])
  })

  it('두 번 참여해도 한 번만 들어간다', async () => {
    const id = await made()
    await joinChallengeHandler(SEO, { challengeId: id })
    await joinChallengeHandler(SEO, { challengeId: id })
    assert.equal((await db.doc(`challenges/${id}`).get()).data().members.length, 2)
  })

  it('거절하면 조용히 빠진다', async () => {
    const id = await made()
    await declineChallengeHandler(SEO, { challengeId: id })
    const c = (await db.doc(`challenges/${id}`).get()).data()
    assert.deepEqual(c.invited, [])
    assert.deepEqual(c.members, [HAN])
  })

  it('초대받지 않았으면 거절도 할 수 없다', async () => {
    const id = await made()
    await assertCode(declineChallengeHandler(NAM, { challengeId: id }), 'permission-denied')
  })

  it('이미 끝난 챌린지에는 참여할 수 없다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    // 규칙을 거치지 않고 기간만 과거로 돌린다
    await db.doc(`challenges/${id}`).update({ from: '2020-01-01', to: '2020-01-10' })
    await assertCode(joinChallengeHandler(SEO, { challengeId: id }), 'failed-precondition')
  })

  it('없는 챌린지는 거부된다', async () => {
    await assertCode(joinChallengeHandler(SEO, { challengeId: '없음' }), 'not-found')
  })
})

describe('deleteChallenge', () => {
  it('방장만 지울 수 있다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await assertCode(deleteChallengeHandler(SEO, { challengeId: id }), 'permission-denied')
    await deleteChallengeHandler(HAN, { challengeId: id })
    assert.equal((await db.doc(`challenges/${id}`).get()).exists, false)
  })
})
