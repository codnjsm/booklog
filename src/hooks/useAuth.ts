import { useState, useEffect } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, signIn, signOutUser } from '../firebase'

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

  return { user, loading, signIn, signOut: signOutUser, cachedName }
}
