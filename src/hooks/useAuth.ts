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

  // 이메일 인증 여부(emailVerified)를 확인하려고 부른다. reload()는 서버 값을 같은 User 인스턴스에
  // 제자리로 채워 넣을 뿐이라 참조가 그대로면 리렌더가 안 일어난다. 얕은 복사로 참조를 바꿔서 반영한다.
  const refreshUser = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false
    await auth.currentUser.reload()
    const fresh = auth.currentUser
    setUser(fresh ? ({ ...fresh } as User) : null)
    return fresh?.emailVerified ?? false
  }, [])

  return { user, loading, signIn, signOut: signOutUser, cachedName, refreshUser }
}
