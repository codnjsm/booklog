import { useCallback, useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { auth, onAuthChange, signIn, signOutUser } from '../firebase'

const DISPLAY_NAME_KEY = 'reading-notes-display-name'

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
  const refreshUser = useCallback(async (): Promise<boolean> => {
    const current = auth.currentUser
    if (!current) return false
    try {
      await current.reload()
      await current.getIdToken(true)
    } catch {
      // 네트워크 문제 등으로 확인에 실패하면 "아직 인증 안 됨"으로 두고 다시 시도하게 한다.
      return false
    }
    const fresh = auth.currentUser
    setUser(fresh ? ({ ...fresh } as User) : null)
    return fresh?.emailVerified ?? false
  }, [])

  return { user, loading, signIn, signOut: signOutUser, cachedName, refreshUser }
}
