import { useEffect, useState } from 'react'

interface Props { msg: string; toastKey?: number }

export default function Toast({ msg, toastKey }: Props) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!toastKey) return
    setMounted(true)
    setVisible(true)
    const hideTimer = setTimeout(() => setVisible(false), 2200)
    const unmountTimer = setTimeout(() => setMounted(false), 2600) // after 0.3s slide-down finishes
    return () => { clearTimeout(hideTimer); clearTimeout(unmountTimer) }
  }, [toastKey])

  if (!mounted) return null
  return <div className={`toast${visible ? ' show' : ''}`}>{msg}</div>
}
