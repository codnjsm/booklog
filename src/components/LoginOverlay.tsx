import { useState } from 'react'
import { IconBooks } from './layout/icons'

function isInAppBrowser() {
  const ua = navigator.userAgent
  return /NAVER|KAKAOTALK|Instagram|FBAN|FBAV|Line\/|MicroMessenger|Snapchat/i.test(ua)
}

interface Props {
  onSignIn: () => Promise<void>
  onDismiss: () => void
}

export default function LoginOverlay({ onSignIn, onDismiss }: Props) {
  const [loading, setLoading] = useState(false)
  const inApp = isInAppBrowser()
  const handleSignIn = async () => {
    setLoading(true)
    try {
      await onSignIn()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-bg z-[200] flex items-center justify-center p-5">
      <div className="bg-surface border border-border rounded-[14px] px-8 py-10 max-w-[380px] w-full text-center shadow-card">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-accentsoft flex items-center justify-center text-accent">
          <IconBooks size={28} />
        </div>
        <h2 className="text-[22px] font-bold mb-2 text-ink">Booklog</h2>
        <p className="text-dim text-sm mb-7 leading-[1.5]">여러 기기에서 동기화하려면 로그인이 필요해요</p>
        {inApp ? (
          <div className="bg-surface2 border border-border rounded-lg p-4 mb-2 text-sm text-ink leading-[1.6] text-center">
            <p>⚠️ 앱 내 브라우저에서는 Google 로그인이 차단돼요.</p>
            <p className="mt-2">Chrome 또는 Safari에서 아래 주소를 열어주세요.</p>
            <div className="mt-3 bg-bg border border-border rounded-md px-3.5 py-2.5 font-mono text-[13px] text-accent break-all">
              reading-notes-6935e.web.app
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2.5 text-dim text-sm py-[11px]">
            <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
            <span>잠시만요…</span>
          </div>
        ) : (
          <button
            className="w-full inline-flex items-center justify-center gap-2.5 bg-white text-[#3c4043] border border-[#dadce0] px-[18px] py-[11px] rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 font-sans hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(60,64,67,0.15)]"
            onClick={handleSignIn}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            <span>Google 계정으로 로그인</span>
          </button>
        )}
        <p className="mt-5 text-xs sm:text-[13px] text-dim leading-[1.6]">
          로그인하지 않아도 이 브라우저에서만 사용할 수 있어요 ·{' '}
          <a className="text-accent cursor-pointer no-underline hover:underline" onClick={onDismiss}>
            나중에
          </a>
        </p>
      </div>
    </div>
  )
}
