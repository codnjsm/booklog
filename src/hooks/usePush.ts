import { useCallback, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { isStandalone, installHow } from '../lib/install'
import { pushUiState, permissionState, readSavedToken, isPushConfigured, type PushUiState } from '../lib/push'
import { enablePush, disablePush, isPushSupported } from '../firebase'
import { useAppUI } from '../contexts/AppUIContext'

/**
 * 푸시 알림 상태와 켜고 끄기.
 *
 * 더보기(토글)·알림함(권유)·친구 탭(수락 직후)이 같은 판단을 쓰므로 한 곳에 둔다.
 * 지원 여부 확인이 비동기라 처음엔 null이고, 확인되면 값이 들어온다.
 */
export function usePush(user: User | null) {
  const { showToast } = useAppUI()
  const [state, setState] = useState<PushUiState | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setState(
      pushUiState({
        configured: isPushConfigured(),
        supported: await isPushSupported(),
        iosNeedsInstall: installHow() === 'ios' && !isStandalone(),
        permission: permissionState(),
        hasToken: !!readSavedToken(),
      }),
    )
  }, [])

  useEffect(() => {
    if (user) void refresh()
    else setState(null)
  }, [user, refresh])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!user || busy) return false
    setBusy(true)
    try {
      const r = await enablePush(user.uid)
      if (r === 'granted') showToast('알림을 켰어요', 'success')
      else if (r === 'denied') showToast('브라우저에서 알림이 막혀 있어요', 'error')
      else showToast('알림을 켜지 못했어요', 'error')
      return r === 'granted'
    } catch {
      showToast('알림을 켜지 못했어요', 'error')
      return false
    } finally {
      await refresh()
      setBusy(false)
    }
  }, [user, busy, showToast, refresh])

  const disable = useCallback(async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      await disablePush(user.uid)
      showToast('알림을 껐어요', 'success')
    } catch {
      showToast('알림을 바꾸지 못했어요', 'error')
    } finally {
      await refresh()
      setBusy(false)
    }
  }, [user, busy, showToast, refresh])

  return { state, busy, enable, disable, refresh }
}
