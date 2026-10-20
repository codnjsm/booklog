import { describe, it, expect } from 'vitest'
import { readVisit, DIRECT } from './analytics'

describe('readVisit — 주소에서 유입 경로 읽기', () => {
  it('꼬리표가 없으면 direct', () => {
    expect(readVisit('')).toEqual({ source: DIRECT, medium: undefined, campaign: undefined })
  })

  it('utm_source를 읽는다', () => {
    expect(readVisit('?utm_source=cafe').source).toBe('cafe')
  })

  it('medium과 campaign도 읽는다', () => {
    expect(readVisit('?utm_source=blog&utm_medium=post&utm_campaign=oct')).toEqual({
      source: 'blog',
      medium: 'post',
      campaign: 'oct',
    })
  })

  it('대소문자는 하나로 모은다 — Cafe와 cafe가 따로 세지면 안 된다', () => {
    expect(readVisit('?utm_source=CAFE').source).toBe('cafe')
  })

  it('앞뒤 공백은 떼어낸다', () => {
    expect(readVisit('?utm_source=%20cafe%20').source).toBe('cafe')
  })

  it('이상한 값은 버리고 direct로 둔다 — 주소는 누구나 고칠 수 있다', () => {
    expect(readVisit('?utm_source=<script>').source).toBe(DIRECT)
    expect(readVisit('?utm_source=' + 'a'.repeat(60)).source).toBe(DIRECT)
  })

  it('빈 값은 없는 것으로 친다', () => {
    expect(readVisit('?utm_source=&utm_medium=').source).toBe(DIRECT)
    expect(readVisit('?utm_source=cafe&utm_medium=').medium).toBeUndefined()
  })

  it('다른 쿼리파라미터가 섞여 있어도 읽는다', () => {
    expect(readVisit('?book=abc&utm_source=cafe&view=feed').source).toBe('cafe')
  })
})
