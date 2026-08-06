import { useEffect, type ReactNode } from 'react'

interface Props { onClose: () => void; children: ReactNode }

export default function Modal({ onClose, children }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}
