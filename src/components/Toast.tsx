import { useEffect, useState } from 'react'
import { useAppUI } from '../contexts/AppUIContext'

export default function Toast() {
  const { toast } = useAppUI()
  const msg = toast?.msg ?? ''
  const toastKey = toast?.key
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!toastKey) return
    setMounted(true)
    setVisible(true)
    const hideTimer = setTimeout(() => setVisible(false), 2200)
    const unmountTimer = setTimeout(() => setMounted(false), 2600) // after 0.3s slide-down finishes
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(unmountTimer)
    }
  }, [toastKey])

  if (!mounted) return null
  return (
    <div
      className={`fixed bottom-[calc(78px+env(safe-area-inset-bottom))] sm:bottom-6 left-1/2 -translate-x-1/2 bg-surface text-ink px-5 py-3 border border-accent rounded-lg text-[13px] z-[200] transition-transform duration-300 ease-in-out shadow-card ${visible ? 'translate-y-0' : 'translate-y-[120%]'}`}
    >
      {msg}
    </div>
  )
}
