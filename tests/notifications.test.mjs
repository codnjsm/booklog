// 알림 정리 콜러블 테스트.
//   npm run test:rules
import { dismissNotificationsHandler, getDb } from '../functions/lib/index.js'
import { before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'

const ME = 'me-n'
const OTHER = 'other-n'

let db

before(() => {
  db = getDb()
})

const MINE = [ME, OTHER]

beforeEach(async () => {
  for (const u of MINE) {
    for (const d of (await db.collection(`notifications/${u}/items`).get()).docs) await d.ref.delete()
  }
})

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

async function put(uid, id, createdAt) {
  await db.doc(`notifications/${uid}/items/${id}`).set({ kind: 'like', actorUid: 'x', createdAt })
}

async function idsOf(uid) {
  return (await db.collection(`notifications/${uid}/items`).get()).docs.map((d) => d.id).sort()
}

describe('dismissNotifications — 읽은 알림 지우기', () => {
  it('지정한 알림이 사라지고 나머지는 남는다', async () => {
    await put(ME, 'a', daysAgo(1))
    await put(ME, 'b', daysAgo(2))

    const r = await dismissNotificationsHandler(ME, ['a'])

    assert.equal(r.removed, 1)
    assert.deepEqual(await idsOf(ME), ['b'])
  })

  it('여러 개를 한 번에 지운다', async () => {
    await put(ME, 'a', daysAgo(1))
    await put(ME, 'b', daysAgo(2))
    await put(ME, 'c', daysAgo(3))

    await dismissNotificationsHandler(ME, ['a', 'c'])

    assert.deepEqual(await idsOf(ME), ['b'])
  })

  it('남의 알림함은 건드리지 않는다 — 내 알림함에서만 지운다', async () => {
    await put(ME, 'a', daysAgo(1))
    await put(OTHER, 'a', daysAgo(1))

    await dismissNotificationsHandler(ME, ['a'])

    assert.deepEqual(await idsOf(ME), [])
    assert.deepEqual(await idsOf(OTHER), ['a'])
  })

  it('없는 id를 보내도 터지지 않는다 — 친구 요청 알림은 서버에 문서가 없다', async () => {
    await put(ME, 'a', daysAgo(1))

    await dismissNotificationsHandler(ME, ['없는id'])

    assert.deepEqual(await idsOf(ME), ['a'])
  })

  it('ids가 비었거나 이상해도 터지지 않는다', async () => {
    await put(ME, 'a', daysAgo(1))

    for (const bad of [[], undefined, null, 'string', [1, 2], [null]]) {
      await dismissNotificationsHandler(ME, bad)
    }
    assert.deepEqual(await idsOf(ME), ['a'])
  })
})

describe('dismissNotifications — 묵은 알림 정리', () => {
  it('90일이 지난 알림은 누르지 않아도 사라진다', async () => {
    await put(ME, 'old', daysAgo(120))
    await put(ME, 'edge', daysAgo(89))
    await put(ME, 'fresh', daysAgo(1))

    await dismissNotificationsHandler(ME, [])

    assert.deepEqual(await idsOf(ME), ['edge', 'fresh'])
  })

  it('100건을 넘으면 오래된 것부터 잘라낸다', async () => {
    // 전부 최근 것으로 둔다 — 날짜를 벌리면 90일 규칙에도 걸려서 무엇 때문에 지워졌는지 흐려진다.
    const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString()
    for (let i = 0; i < 105; i++) await put(ME, `n${String(i).padStart(3, '0')}`, hoursAgo(105 - i))

    await dismissNotificationsHandler(ME, [])

    const left = await idsOf(ME)
    assert.equal(left.length, 100)
    // 가장 오래된 다섯 건(n000~n004)이 빠진다
    assert.equal(left.includes('n000'), false)
    assert.equal(left.includes('n004'), false)
    assert.equal(left.includes('n005'), true)
    assert.equal(left.includes('n104'), true)
  })

  it('100건 이하이고 묵은 것도 없으면 아무것도 지우지 않는다', async () => {
    await put(ME, 'a', daysAgo(1))
    await put(ME, 'b', daysAgo(2))

    const r = await dismissNotificationsHandler(ME, [])

    assert.equal(r.removed, 0)
    assert.deepEqual(await idsOf(ME), ['a', 'b'])
  })

  it('누른 것과 정리 대상이 겹쳐도 한 번만 센다', async () => {
    await put(ME, 'old', daysAgo(120))

    const r = await dismissNotificationsHandler(ME, ['old'])

    assert.equal(r.removed, 1)
    assert.deepEqual(await idsOf(ME), [])
  })
})
