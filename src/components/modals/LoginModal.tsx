import { useState } from 'react'
import Modal from './Modal'
import { authErrorMessage } from '../../firebase'
import { useAppUI } from '../../contexts/AppUIContext'
import { IconEye, IconEyeOff } from '../layout/icons'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[420px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const FORM_GROUP = 'mb-3.5'
const FORM_LABEL = 'flex text-xs sm:text-[13px] mb-2 uppercase tracking-[.05em] text-dim'
const FORM_INPUT =
  'w-full bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] sm:text-[14px] font-sans placeholder:text-dim placeholder:opacity-50 focus:outline-none focus:border-accent'
const PASSWORD_TOGGLE =
  'absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-dim cursor-pointer p-0 flex items-center hover:text-ink'
const BTN =
  'w-full bg-ink text-bg border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'w-full bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed'
const SEG_WRAP = 'flex gap-0.5 p-0.5 mb-4 rounded-[9px] bg-surface2 border border-border'
const SEG = 'flex-1 py-1.5 rounded-md text-xs sm:text-[13px] border-none cursor-pointer transition-colors duration-150'
const LINK_BTN = 'bg-transparent border-none text-accent text-xs sm:text-[13px] cursor-pointer hover:underline p-0'

type Mode = 'login' | 'signup' | 'reset'

interface Props {
  reason?: 'promote'
  onClose: () => void
  onGoogleSignIn: () => Promise<'ok' | 'blocked' | 'error'>
  onEmailSignUp: (name: string, email: string, password: string) => Promise<void>
  onEmailSignIn: (email: string, password: string) => Promise<void>
  onPasswordReset: (email: string) => Promise<void>
}

export default function LoginModal({
  reason,
  onClose,
  onGoogleSignIn,
  onEmailSignUp,
  onEmailSignIn,
  onPasswordReset,
}: Props) {
  const { showToast } = useAppUI()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inAppBlocked, setInAppBlocked] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const handleGoogleClick = async () => {
    setSubmitting(true)
    const result = await onGoogleSignIn()
    setSubmitting(false)
    if (result === 'blocked') setInAppBlocked(true)
    else if (result === 'ok') onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signup' && password !== passwordConfirm) {
      showToast('비밀번호가 일치하지 않아요', 'error')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'signup') await onEmailSignUp(name.trim(), email.trim(), password)
      else await onEmailSignIn(email.trim(), password)
      onClose()
    } catch (err) {
      const { msg, type } = authErrorMessage(err)
      showToast(msg, type)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onPasswordReset(email.trim())
      setResetSent(true)
    } catch (err) {
      const { msg, type } = authErrorMessage(err)
      showToast(msg, type)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="login-modal-title">
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id="login-modal-title" className="font-sans text-base font-semibold">
            {mode === 'reset' ? '비밀번호 재설정' : '로그인'}
          </h3>
          <button className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={MODAL_BODY}>
          {reason === 'promote' && mode !== 'reset' && (
            <div className="bg-surface2 rounded-lg px-4 py-3 mb-4">
              <div className="text-sm font-semibold text-ink mb-1">기록이 쌓이고 있어요</div>
              <p className="text-xs sm:text-[13px] text-dim leading-relaxed">
                지금까지의 기록은 이 브라우저에만 저장돼 있어요. 브라우저 데이터를 지우거나 다른 기기에서 열면 볼 수
                없어요.
              </p>
            </div>
          )}

          {mode === 'reset' ? (
            resetSent ? (
              <div>
                <p className="text-xs sm:text-[13px] text-ink leading-relaxed mb-4">
                  <b>{email}</b>로 재설정 메일을 보냈어요.
                  <br />
                  메일함(스팸함 포함)을 확인해주세요.
                </p>
                <button className={BTN_SECONDARY} onClick={() => setMode('login')}>
                  로그인으로 돌아가기
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit}>
                <div className={FORM_GROUP}>
                  {/* 로그인·가입 화면과 달리 "아무 이메일"이 아니라 "그때 그 이메일"이어야 한다는 걸
                      라벨에서부터 알린다. */}
                  <label className={FORM_LABEL}>가입 이메일</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={FORM_INPUT}
                  />
                  {/* 재설정은 이메일이 유일한 단서다. 여기 온 사람은 이미 로그인을 못 하고 있으므로,
                      헛수고를 줄이도록 사실대로 알리고 구글 가입 가능성을 확인하게 한다. */}
                  <p className="mt-2 text-xs text-dim leading-relaxed">
                    이메일이 기억나지 않으면 비밀번호를 재설정할 수 없어요.
                    <br />
                    Google 계정으로 가입한 건 아닌지 확인해보세요.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="submit" className={BTN} disabled={submitting}>
                    {submitting ? '보내는 중…' : '재설정 메일 보내기'}
                  </button>
                  <button type="button" className={BTN_SECONDARY} onClick={() => setMode('login')}>
                    취소
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              {inAppBlocked ? (
                <div className="bg-surface2 border border-border rounded-lg p-4 text-sm text-ink leading-[1.6] text-center mb-4">
                  <p>⚠️ 앱 내 브라우저에서는 Google 로그인이 차단돼요.</p>
                  <p className="mt-2">Chrome 또는 Safari에서 아래 주소를 열어주세요.</p>
                  <div className="mt-3 bg-bg border border-border rounded-md px-3.5 py-2.5 font-mono text-[13px] text-accent break-all">
                    reading-notes-6935e.web.app
                  </div>
                </div>
              ) : (
                <button
                  className="w-full inline-flex items-center justify-center gap-2.5 bg-white text-[#3c4043] border border-[#dadce0] px-[18px] py-[11px] rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 font-sans hover:bg-[#f8f9fa] hover:shadow-[0_1px_3px_rgba(60,64,67,0.15)] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                  onClick={handleGoogleClick}
                  disabled={submitting}
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

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-dim">또는</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className={SEG_WRAP}>
                <button
                  onClick={() => setMode('login')}
                  className={`${SEG} ${mode === 'login' ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'}`}
                >
                  로그인
                </button>
                <button
                  onClick={() => setMode('signup')}
                  className={`${SEG} ${mode === 'signup' ? 'bg-surface text-ink font-medium shadow-card' : 'bg-transparent text-dim'}`}
                >
                  회원가입
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {mode === 'signup' && (
                  <div className={FORM_GROUP}>
                    <label className={FORM_LABEL}>이름</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={FORM_INPUT}
                    />
                  </div>
                )}
                <div className={FORM_GROUP}>
                  <label className={FORM_LABEL}>이메일</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={FORM_INPUT}
                  />
                </div>
                <div className={FORM_GROUP}>
                  <label className={FORM_LABEL}>비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={mode === 'signup' ? 6 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${FORM_INPUT} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      className={PASSWORD_TOGGLE}
                    >
                      {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                  </div>
                </div>
                {mode === 'signup' && (
                  <div className={FORM_GROUP}>
                    <label className={FORM_LABEL}>비밀번호 확인</label>
                    <div className="relative">
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className={`${FORM_INPUT} pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm((v) => !v)}
                        aria-label={showPasswordConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
                        className={PASSWORD_TOGGLE}
                      >
                        {showPasswordConfirm ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </button>
                    </div>
                  </div>
                )}
                {mode === 'login' && (
                  <button type="button" className={`${LINK_BTN} mb-3.5`} onClick={() => setMode('reset')}>
                    비밀번호를 잊으셨나요?
                  </button>
                )}
                <button type="submit" className={BTN} disabled={submitting}>
                  {submitting ? '처리 중…' : mode === 'signup' ? '가입하기' : '로그인'}
                </button>
              </form>

              {reason === 'promote' && (
                <p className="mt-4 text-xs sm:text-[13px] text-dim text-center leading-relaxed">
                  로그인하지 않아도 이 브라우저에서는 계속 사용할 수 있어요
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
