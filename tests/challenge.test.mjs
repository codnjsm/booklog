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
  leaveChallengeHandler,
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

// ── 현황 조회와 정산 ──────────────────────────────────────────
import { getChallengeHandler, listChallengesHandler } from '../functions/lib/index.js'

/** 이미 끝난 기간으로 바꾼다. 만들 때는 미래만 허용되므로 규칙을 거치지 않고 직접 고친다. */
async function endPeriod(id, from = '2026-09-01', to = '2026-09-10') {
  await db.doc(`challenges/${id}`).update({ from, to })
}

async function giveRecords(uid, dates) {
  await db.doc(`reading-notes/${uid}`).set({
    books: [{ id: 'b1', title: '책', createdAt: dates[0] + 'T03:00:00.000Z', readDates: dates }],
    quotes: [],
    words: [],
  })
}

describe('getChallenge — 현황', () => {
  beforeEach(async () => {
    for (const u of MINE) {
      await db.doc(`users/${u}`).set({ displayName: u.toUpperCase(), photoURL: '' })
      await db.doc(`reading-notes/${u}`).delete()
      for (const d of (await db.collection(`users/${u}/badges`).get()).docs) await d.ref.delete()
    }
  })

  it('참여자별 기록한 날 수가 나온다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })
    await giveRecords(HAN, [from])
    await giveRecords(SEO, [from, to])

    const v = await getChallengeHandler(HAN, { challengeId: id })

    const byUid = Object.fromEntries(v.members.map((m) => [m.uid, m.days]))
    assert.equal(byUid[HAN], 1)
    assert.equal(byUid[SEO], 2)
  })

  it('수락 전인 사람은 invited로 따로 나온다 — 부른 쪽이 보냈는지 확인할 수 있어야 한다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.deepEqual(
      v.members.map((m) => m.uid),
      [HAN],
    )
    assert.deepEqual(
      v.invited.map((m) => m.uid),
      [SEO],
    )
  })

  it('수락하면 invited에서 빠지고 members로 옮겨간다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.deepEqual(v.invited, [])
    assert.equal(v.members.length, 2)
  })

  it('invited에는 기록한 날 수를 담지 않는다 — 아직 참여자가 아니다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await giveRecords(SEO, [from, to])

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.equal(v.invited.length, 1)
    assert.equal(v.invited[0].days, undefined)
  })

  it('만든 뒤에 부른 사람도 invited에 들어간다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3 })

    await inviteToChallengeHandler(HAN, { challengeId: id, toUid: SEO })

    const v = await getChallengeHandler(HAN, { challengeId: id })
    assert.deepEqual(
      v.invited.map((m) => m.uid),
      [SEO],
    )
  })

  it('참여자는 나갈 수 있다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })

    await leaveChallengeHandler(SEO, { challengeId: id })

    const v = await getChallengeHandler(HAN, { challengeId: id })
    assert.deepEqual(
      v.members.map((m) => m.uid),
      [HAN],
    )
    assert.deepEqual(v.invited, [])
  })

  it('만든 사람은 나갈 수 없다 — 나가면 아무도 못 지우는 챌린지가 된다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })

    await assertCode(leaveChallengeHandler(HAN, { challengeId: id }), 'failed-precondition')
  })

  it('참여하지 않았으면 나갈 수도 없다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3 })

    await assertCode(leaveChallengeHandler(SEO, { challengeId: id }), 'permission-denied')
  })

  it('나간 사람의 기록은 더 이상 세지 않는다', async () => {
    const { from, to } = period(10)
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })
    await giveRecords(SEO, [from, to])

    await leaveChallengeHandler(SEO, { challengeId: id })

    const v = await getChallengeHandler(HAN, { challengeId: id })
    assert.equal(
      v.members.find((m) => m.uid === SEO),
      undefined,
    )
  })

  it('참여하지 않은 사람의 기록은 세지 않는다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3 })
    await giveRecords(MIN, [from, to])

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.deepEqual(
      v.members.map((m) => m.uid),
      [HAN],
    )
  })

  it('탈퇴한 참여자는 빼고 보여준다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })
    await db.doc(`users/${SEO}`).delete() // 탈퇴

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.deepEqual(
      v.members.map((m) => m.uid),
      [HAN],
    )
  })

  it('날짜 수 말고 기록 내용은 나가지 않는다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3 })
    await db.doc(`reading-notes/${HAN}`).set({
      books: [{ id: 'b1', title: '아무도 몰라야 하는 책', createdAt: from + 'T03:00:00.000Z', isPrivate: true }],
      quotes: [{ id: 'q1', text: '비밀 문장', createdAt: from + 'T03:00:00.000Z' }],
      words: [],
    })

    const v = await getChallengeHandler(HAN, { challengeId: id })

    const dumped = JSON.stringify(v)
    assert.equal(dumped.includes('아무도 몰라야 하는 책'), false)
    assert.equal(dumped.includes('비밀 문장'), false)
    assert.equal(v.members[0].days, 1)
  })

  it('참여하지 않은 사람은 볼 수 없다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3 })
    await assertCode(getChallengeHandler(NAM, { challengeId: id }), 'permission-denied')
  })
})

describe('정산과 뱃지', () => {
  beforeEach(async () => {
    for (const u of MINE) {
      await db.doc(`users/${u}`).set({ displayName: u.toUpperCase(), photoURL: '' })
      await db.doc(`reading-notes/${u}`).delete()
      for (const d of (await db.collection(`users/${u}/badges`).get()).docs) await d.ref.delete()
    }
  })

  async function endedChallenge(goalDays = 2) {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })
    await endPeriod(id)
    return id
  }

  it('기간이 끝나기 전에는 뱃지가 안 생긴다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 1 })
    await giveRecords(HAN, [from])

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.equal(v.ended, false)
    assert.equal((await db.collection(`users/${HAN}/badges`).get()).size, 0)
  })

  it('목표를 채우면 뱃지가 남는다', async () => {
    const id = await endedChallenge(2)
    await giveRecords(HAN, ['2026-09-02', '2026-09-03'])

    const v = await getChallengeHandler(HAN, { challengeId: id })

    assert.equal(v.ended, true)
    const badges = await db.collection(`users/${HAN}/badges`).get()
    assert.equal(badges.size, 1)
    assert.equal(badges.docs[0].id, id)
    assert.equal(badges.docs[0].data().days, 2)
  })

  it('여러 명이 동시에 달성할 수 있다 — 1등만 주면 나머지가 그만둔다', async () => {
    const id = await endedChallenge(2)
    await giveRecords(HAN, ['2026-09-02', '2026-09-03'])
    await giveRecords(SEO, ['2026-09-02', '2026-09-03', '2026-09-04'])

    await getChallengeHandler(HAN, { challengeId: id })

    assert.equal((await db.collection(`users/${HAN}/badges`).get()).size, 1)
    assert.equal((await db.collection(`users/${SEO}/badges`).get()).size, 1)
  })

  it('못 채우면 뱃지가 안 남는다', async () => {
    const id = await endedChallenge(3)
    await giveRecords(HAN, ['2026-09-02'])

    await getChallengeHandler(HAN, { challengeId: id })

    assert.equal((await db.collection(`users/${HAN}/badges`).get()).size, 0)
  })

  it('여러 번 열어도 뱃지가 두 번 생기지 않는다', async () => {
    const id = await endedChallenge(1)
    await giveRecords(HAN, ['2026-09-02'])

    await getChallengeHandler(HAN, { challengeId: id })
    await getChallengeHandler(HAN, { challengeId: id })
    await getChallengeHandler(SEO, { challengeId: id })

    assert.equal((await db.collection(`users/${HAN}/badges`).get()).size, 1)
  })

  it('먼저 연 사람이 모두의 몫을 정산한다 — 본인이 안 열어도 뱃지가 남는다', async () => {
    const id = await endedChallenge(1)
    await giveRecords(SEO, ['2026-09-02'])

    await getChallengeHandler(HAN, { challengeId: id }) // HAN만 열었다

    assert.equal((await db.collection(`users/${SEO}/badges`).get()).size, 1)
  })
})

describe('listChallenges', () => {
  beforeEach(async () => {
    for (const u of MINE) await db.doc(`users/${u}`).set({ displayName: u.toUpperCase(), photoURL: '' })
  })

  it('참여 중인 것과 초대받은 것이 나뉘어 나온다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })

    const mine = await listChallengesHandler(HAN)
    assert.deepEqual(
      mine.joined.map((c) => c.id),
      [id],
    )
    assert.deepEqual(mine.invited, [])

    const theirs = await listChallengesHandler(SEO)
    assert.deepEqual(theirs.joined, [])
    assert.deepEqual(
      theirs.invited.map((c) => c.id),
      [id],
    )
  })

  it('남의 챌린지는 안 나온다', async () => {
    const { from, to } = period()
    await createChallengeHandler(HAN, { from, to, goalDays: 3 })
    const v = await listChallengesHandler(NAM)
    assert.deepEqual(v.joined, [])
    assert.deepEqual(v.invited, [])
  })
})

// ── 알림 ──────────────────────────────────────────────────────
describe('챌린지 알림', () => {
  beforeEach(async () => {
    for (const u of MINE) {
      await db.doc(`users/${u}`).set({ displayName: u.toUpperCase(), photoURL: '' })
      await db.doc(`reading-notes/${u}`).delete()
      for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
      for (const d of (await db.collection(`users/${u}/badges`).get()).docs) await d.ref.delete()
    }
  })

  const notisOf = async (uid) =>
    (await db.collection(`notifications/${uid}/items`).get()).docs.map((d) => ({ id: d.id, ...d.data() }))

  it('만들면서 부른 사람에게 초대 알림이 간다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })

    const n = await notisOf(SEO)
    assert.equal(n.length, 1)
    assert.equal(n[0].kind, 'challengeInvite')
    assert.equal(n[0].actorUid, HAN)
    assert.equal(n[0].id, `challengeInvite_${id}`)
  })

  it('방장 자신에게는 초대 알림이 안 간다', async () => {
    const { from, to } = period()
    await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    assert.deepEqual(await notisOf(HAN), [])
  })

  it('같은 사람을 두 번 불러도 알림이 쌓이지 않는다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await inviteToChallengeHandler(HAN, { challengeId: id, toUid: SEO })
    assert.equal((await notisOf(SEO)).length, 1)
  })

  it('참여하면 방장에게 알림이 간다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })

    const n = await notisOf(HAN)
    assert.equal(n.length, 1)
    assert.equal(n[0].kind, 'challengeJoined')
    assert.equal(n[0].actorUid, SEO)
  })

  it('거절하면 아무에게도 알림이 가지 않는다 — 친구 요청과 같은 기준', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 3, invite: [SEO] })
    await declineChallengeHandler(SEO, { challengeId: id })
    assert.deepEqual(await notisOf(HAN), [])
  })

  it('완주하면 본인에게 알림이 간다 — 보낸 사람이 없는 알림이다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 1, invite: [SEO] })
    await joinChallengeHandler(SEO, { challengeId: id })
    await endPeriod(id)
    await giveRecords(SEO, ['2026-09-02'])
    for (const d of (await db.collection(`notifications/${HAN}/items`).get()).docs) await d.ref.delete()

    await getChallengeHandler(HAN, { challengeId: id })

    const n = await notisOf(SEO)
    const achieved = n.filter((x) => x.kind === 'challengeAchieved')
    assert.equal(achieved.length, 1)
    assert.equal(achieved[0].id, `challengeAchieved_${id}`)
    // 완주 못 한 방장에게는 안 간다
    assert.deepEqual(
      (await notisOf(HAN)).filter((x) => x.kind === 'challengeAchieved'),
      [],
    )
  })

  it('여러 번 정산해도 완주 알림이 쌓이지 않는다', async () => {
    const { from, to } = period()
    const { id } = await createChallengeHandler(HAN, { from, to, goalDays: 1 })
    await endPeriod(id)
    await giveRecords(HAN, ['2026-09-02'])

    await getChallengeHandler(HAN, { challengeId: id })
    await getChallengeHandler(HAN, { challengeId: id })

    assert.equal((await notisOf(HAN)).filter((x) => x.kind === 'challengeAchieved').length, 1)
  })
})
