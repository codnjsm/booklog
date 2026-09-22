import { useCallback, useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { auth, onAuthChange, signIn, signOutUser } from '../firebase'

const DISPLAY_NAME_KEY = 'reading-notes-display-name'

/**
 * 이메일 인증 여부를 다시 확인한 결과.
 * - verified: 인증됨 / pending: 아직 메일의 링크를 안 누름
 * - signed-out: 세션이 끊김. 다시 로그인해야 한다 (이메일을 바꾸면 기존 토큰이 무효가 된다)
 * - error: 네트워크 등으로 확인 자체를 못 함. 다시 시도하면 된다
 */
export type VerifyResult = 'verified' | 'pending' | 'signed-out' | 'error'

/** 이 코드들이 오면 로그인 상태가 이미 끝난 것이라, 재시도가 아니라 재로그인이 필요하다. */
const SESSION_GONE = new Set([
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-not-found',
  'auth/user-disabled',
])

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Firebase 로그인 확인이 비동기라 첫 렌더 때 user가 잠깐 null이다.
  // 마지막으로 확인된 이름을 캐시해서, 그 사이 인사말에서 이름이 늦게 붙는 걸 막는다.
  const [cachedName, setCachedName] = useState(() => localStorage.getItem(DISPLAY_NAME_KEY) ?? undefined)

  useEffect(() => {
    return onAuthChange((u) => {
      setUser(u)
      setLoading(false)
      const name = u?.displayName?.split(' ')[0]
      if (name) {
        setCachedName(name)
        localStorage.setItem(DISPLAY_NAME_KEY, name)
      } else {
        setCachedName(undefined)
        localStorage.removeItem(DISPLAY_NAME_KEY)
      }
    })
  }, [])

  // 이메일 인증 여부(emailVerified)를 확인하려고 부른다.
  //
  // reload()만으로는 부족하다. reload()는 사용자 정보를 같은 User 인스턴스에 제자리로 채워 넣어
  // 화면 쪽 emailVerified만 최신으로 만든다. 반면 서버(Firestore 규칙·Cloud Functions)가 보는 값은
  // 로그인할 때 발급된 ID 토큰 안의 email_verified 클레임이고, 이 토큰은 최대 1시간 캐시된다.
  // 그래서 getIdToken(true)로 토큰을 강제로 새로 받지 않으면 "화면은 열렸는데 친구 검색은 계속
  // 거부되는" 상태가 된다.
  //
  // 참조가 그대로면 리렌더가 안 되므로 얕은 복사로 참조를 바꿔서 반영한다.
  const refreshUser = useCallback(async (): Promise<VerifyResult> => {
    const current = auth.currentUser
    if (!current) return 'signed-out'
    try {
      await current.reload()
      await current.getIdToken(true)
    } catch (err) {
      const code = (err as { code?: string } | null | undefined)?.code
      // 세션이 죽은 것과 네트워크 실패를 구분한다. 예전에는 둘 다 "아직 인증 전"으로 알렸는데,
      // 이메일을 바꾸면 Firebase가 기존 토큰을 무효화하므로 인증 링크를 누르고 돌아와
      // "인증했어요"를 누른 사람에게 정반대의 안내가 나갔다(그리고 그대로 로그아웃됐다).
      return code && SESSION_GONE.has(code) ? 'signed-out' : 'error'
    }
    const fresh = auth.currentUser
    setUser(fresh ? ({ ...fresh } as User) : null)
    if (!fresh) return 'signed-out'
    return fresh.emailVerified ? 'verified' : 'pending'
  }, [])

  return { user, loading, signIn, signOut: signOutUser, cachedName, refreshUser }
}
