import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { SyncStatus } from '../hooks/useData'
import { useAppUI } from '../contexts/AppUIContext'
import { isStorageAtRiskBrowser } from '../lib/browser'
import PageHeader from './layout/PageHeader'
import AvatarCropModal from './modals/AvatarCropModal'
import NameEditModal from './modals/NameEditModal'
import EmailChangeModal from './modals/EmailChangeModal'
import DeleteAccountModal from './modals/DeleteAccountModal'
import {
  IconFriends,
  IconExport,
  IconSun,
  IconMoon,
  IconSignOut,
  IconChevronRight,
  IconBooks,
  IconCamera,
  IconPencil,
  IconTrash,
} from './layout/icons'

interface Props {
  user: User | null
  /** 내 프로필 사진(users 문서 기준). 없으면 이름 첫 글자 아바타를 쓴다. */
  photoURL: string
  /** 빈 문자열을 넘기면 사진을 지운다. */
  onChangePhoto: (photoURL: string) => Promise<void>
  /** 내 표시 이름(users 문서 기준). */
  displayName: string
  onChangeName: (displayName: string) => Promise<void>
  onSendVerification: () => Promise<void>
  onRefreshUser: () => Promise<boolean>
  onChangeEmail: (email: string) => Promise<void>
  syncStatus: SyncStatus
  incomingCount: number
  /** 게스트가 이 브라우저에만 쌓아둔 기록 수(책+문장+단어). 로그인을 권할 때 위험을 구체적으로 보여준다. */
  recordCount: number
  onExport: () => void
  onSignOut: () => void
  onSignIn: () => void
  /** 계정과 모든 기록을 영구 삭제한다. 실패하면 던져서 모달이 닫히지 않게 한다. */
  onDeleteAccount: () => Promise<void>
}

const ROW =
  'w-full flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl text-left cursor-pointer'

export default function MoreTab({
  user,
  photoURL,
  onChangePhoto,
  displayName,
  onChangeName,
  onSendVerification,
  onRefreshUser,
  onChangeEmail,
  syncStatus,
  incomingCount,
  recordCount,
  onExport,
  onSignOut,
  onSignIn,
  onDeleteAccount,
}: Props) {
  const { changeTab, theme, toggleTheme, openWelcome, showToast } = useAppUI()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [nameEditing, setNameEditing] = useState(false)
  const [emailChanging, setEmailChanging] = useState(false)
  const [verifySending, setVerifySending] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 이메일 가입자만 해당한다. Google 로그인은 항상 인증된 상태로 들어온다.
  const needsVerify = !!user && !user.emailVerified

  const handleResendVerification = async () => {
    setVerifySending(true)
    try {
      await onSendVerification()
      showToast('인증 메일을 다시 보냈어요', 'success')
    } catch {
      showToast('메일을 보내지 못했어요', 'error')
    } finally {
      setVerifySending(false)
    }
  }

  const handleCheckVerified = async () => {
    const verified = await onRefreshUser()
    showToast(verified ? '이메일 인증이 확인됐어요' : '아직 인증 전이에요', verified ? 'success' : 'info')
  }

  const saveName = async (next: string) => {
    setNameEditing(false)
    try {
      await onChangeName(next)
      showToast('이름을 바꿨어요', 'success')
    } catch {
      showToast('이름을 저장하지 못했어요', 'error')
    }
  }

  // 모달과 같은 규칙 — 열려 있는 동안 Escape로 닫힌다.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const syncLabel = syncStatus === 'saving' ? '저장 중…' : syncStatus === 'error' ? '저장 실패' : '동기화됨'
  const syncColor = syncStatus === 'saving' ? 'bg-accent' : syncStatus === 'error' ? 'bg-danger' : 'bg-ok'

  // 사진이 없으면 고를 것밖에 없으니 바로 파일 선택기를 연다.
  // 이미 있을 때만 "변경 / 초기화"를 고르는 메뉴를 띄운다.
  const handlePhotoClick = () => {
    if (!photoURL) photoInputRef.current?.click()
    else setMenuOpen(true)
  }

  const savePhoto = async (next: string) => {
    setMenuOpen(false)
    setPhotoSaving(true)
    try {
      await onChangePhoto(next)
      showToast(next ? '프로필 사진을 바꿨어요' : '프로필 사진을 지웠어요', 'success')
    } catch {
      showToast('사진을 저장하지 못했어요', 'error')
    } finally {
      setPhotoSaving(false)
    }
  }

  // 고른 사진을 바로 저장하지 않고, 어느 부분을 쓸지 먼저 고르게 한다.
  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setCropFile(file)
  }

  return (
    <div>
      <PageHeader title="더보기" />

      <div className="flex flex-col gap-3">
        {user ? (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl">
            <div className="relative flex-shrink-0">
              {menuOpen && (
                <>
                  {/* 바깥을 눌러 닫는다. HomeFab과 같은 방식 */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[124px] bg-surface border border-border rounded-xl shadow-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        photoInputRef.current?.click()
                      }}
                      className="w-full px-4 py-2.5 text-left text-[13px] whitespace-nowrap text-ink bg-transparent border-none cursor-pointer hover:bg-surface2"
                    >
                      사진 변경
                    </button>
                    {/* border-none과 border-t를 같이 주면 style이 none이라 선이 안 그려진다. border-0으로 폭만 0으로 둔다 */}
                    <button
                      type="button"
                      onClick={() => savePhoto('')}
                      className="w-full px-4 py-2.5 text-left text-[13px] whitespace-nowrap text-danger bg-transparent border-0 border-t border-border cursor-pointer hover:bg-surface2"
                    >
                      사진 초기화
                    </button>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={handlePhotoClick}
                disabled={photoSaving}
                aria-haspopup={photoURL ? 'menu' : undefined}
                aria-expanded={photoURL ? menuOpen : undefined}
                aria-label={photoURL ? '프로필 사진 바꾸기' : '프로필 사진 추가'}
                className="relative block w-11 h-11 bg-transparent border-none p-0 cursor-pointer rounded-full disabled:opacity-60"
              >
                {photoURL ? (
                  <img
                    src={photoURL}
                    referrerPolicy="no-referrer"
                    alt=""
                    className="w-11 h-11 rounded-full object-cover block"
                  />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-accentfill text-white flex items-center justify-center text-[17px] font-semibold">
                    {(displayName || user.email || '?')[0].toUpperCase()}
                  </span>
                )}
                {/* 바꾸려는 대상(아바타) 위에 입구를 둔다. accent는 "앱이 말하는 것"(완료·진행률·주요 버튼)에
                    쓰는 색이라 프로필 수정 같은 보조 동작에는 쓰지 않는다. 이름 옆 연필과 같은 칩 모양으로 맞춘다.
                    옅은 그림자는 사진 위에서 칩이 묻히지 않게 하는 용도. */}
                <span className="absolute -right-0.5 -bottom-0.5 w-[22px] h-[22px] rounded-full bg-surface border border-border text-dim flex items-center justify-center [box-shadow:0_1px_3px_rgba(0,0,0,0.12)]">
                  <IconCamera size={12} />
                </span>
              </button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} className="hidden" />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[15px] font-semibold truncate">{displayName || '사용자'}</span>
                {/* 보이는 칩은 22px로 카메라와 같게 맞추고, 버튼 자체는 24px로 둬서 터치 영역 기준을 지킨다. */}
                <button
                  type="button"
                  onClick={() => setNameEditing(true)}
                  aria-label="이름 수정"
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-transparent border-none p-0 text-dim cursor-pointer hover:text-ink"
                >
                  <span className="w-[22px] h-[22px] rounded-full bg-surface border border-border flex items-center justify-center">
                    <IconPencil size={12} />
                  </span>
                </button>
              </div>
              <div className="text-xs sm:text-[13px] text-dim truncate">{user.email}</div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface2 flex-shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${syncColor}`} />
              <span className="font-mono text-[10px] text-dim">{syncLabel}</span>
            </div>
          </div>
        ) : null}

        {/* 문제가 있을 때만 나온다. 주소를 잘못 적었으면 메일이 안 오는데, 그걸 모른 채 기록만 쌓이면
            나중에 비밀번호를 잊었을 때 계정을 통째로 잃는다. 그래서 "인증 필요"를 알리는 데서 그치지 않고
            주소를 고칠 길(이메일 변경)까지 같은 자리에 둔다. */}
        {needsVerify && (
          <div className="flex flex-col gap-2.5 px-4 py-3.5 bg-dangersoft border border-danger/30 rounded-xl">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] sm:text-sm font-semibold text-ink">이메일 인증이 필요해요</span>
              <span className="text-xs sm:text-[13px] text-dim leading-relaxed">
                {user?.email} 으로 보낸 메일을 확인해주세요. 인증 전에는 친구 기능을 쓸 수 없고, 주소가 잘못돼 있으면
                나중에 비밀번호를 찾을 수 없어요.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={verifySending}
                className="px-3 py-1.5 rounded-lg text-[13px] bg-surface text-ink border border-border cursor-pointer hover:bg-surface2 disabled:opacity-50"
              >
                {verifySending ? '보내는 중…' : '메일 다시 보내기'}
              </button>
              <button
                type="button"
                onClick={handleCheckVerified}
                className="px-3 py-1.5 rounded-lg text-[13px] bg-surface text-ink border border-border cursor-pointer hover:bg-surface2"
              >
                인증했어요
              </button>
              <button
                type="button"
                onClick={() => setEmailChanging(true)}
                className="px-3 py-1.5 rounded-lg text-[13px] bg-transparent text-dim border border-border cursor-pointer hover:text-ink"
              >
                이메일 변경
              </button>
            </div>
          </div>
        )}

        {!user && (
          <button className={ROW} onClick={onSignIn}>
            <span className="w-11 h-11 rounded-full bg-surface2 text-dim flex items-center justify-center flex-shrink-0">
              <IconFriends size={20} />
            </span>
            <span className="flex-1 flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-ink">로그인</span>
              {/* 기록이 쌓인 뒤로는 "동기화하면 좋다"가 아니라 "지금 잃을 수 있다"가 사실에 가깝다.
                  로그인할 때까지 계속 남아 있는 상태라, 모달로 한 번 알리는 대신 여기에 상시 표시한다.
                  Safari·아이폰은 7일 미접속 시 브라우저가 알아서 지울 수 있어 위험을 구체적으로 알린다. */}
              <span className="text-xs sm:text-[13px] text-dim">
                {recordCount > 0
                  ? isStorageAtRiskBrowser()
                    ? `기록 ${recordCount}개가 이 브라우저에만 저장돼 있어요. 7일 넘게 접속 안 하면 사라질 수 있어요`
                    : `기록 ${recordCount}개가 이 브라우저에만 저장돼 있어요`
                  : '여러 기기에서 동기화하려면 로그인이 필요해요'}
              </span>
            </span>
            <IconChevronRight />
          </button>
        )}

        <div className="flex flex-col gap-2">
          <div className={ROW.replace('cursor-pointer', '')}>
            <span className="text-dim">{theme === 'light' ? <IconSun size={19} /> : <IconMoon size={19} />}</span>
            <span className="text-sm text-ink">테마</span>
            <span className="flex-1" />
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface2 border border-border">
              <button
                onClick={() => {
                  if (theme !== 'light') toggleTheme()
                }}
                className={`px-3 py-1 rounded-md text-xs sm:text-[13px] border-none cursor-pointer ${theme === 'light' ? 'bg-surface text-ink font-medium' : 'bg-transparent text-dim'}`}
              >
                라이트
              </button>
              <button
                onClick={() => {
                  if (theme !== 'dark') toggleTheme()
                }}
                className={`px-3 py-1 rounded-md text-xs sm:text-[13px] border-none cursor-pointer ${theme === 'dark' ? 'bg-surface text-ink font-medium' : 'bg-transparent text-dim'}`}
              >
                다크
              </button>
            </div>
          </div>

          <button className={ROW} onClick={() => changeTab('friends')}>
            <span className="text-dim">
              <IconFriends size={19} />
            </span>
            <span className="text-sm text-ink">친구</span>
            {incomingCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
            <span className="flex-1" />
            <span className="text-dim">
              <IconChevronRight />
            </span>
          </button>

          <button className={ROW} onClick={openWelcome}>
            <span className="text-dim">
              <IconBooks size={19} />
            </span>
            <span className="text-sm text-ink">기능 소개</span>
            <span className="flex-1" />
            <span className="text-dim">
              <IconChevronRight />
            </span>
          </button>

          <button className={ROW} onClick={onExport}>
            <span className="text-dim">
              <IconExport size={19} />
            </span>
            <span className="text-sm text-ink">기록 내보내기</span>
            <span className="flex-1" />
            <span className="font-mono text-[10px] text-dim">.txt</span>
          </button>

          {user && (
            <button className={ROW} onClick={onSignOut}>
              <span className="text-dim">
                <IconSignOut size={19} />
              </span>
              <span className="text-sm text-ink">로그아웃</span>
            </button>
          )}

          {/* 되돌릴 수 없는 동작이라 로그아웃과 같은 생김새로 두지 않는다.
              글자를 danger로 두고, 실제 삭제는 확인 문구를 입력해야 열리는 모달에서 받는다. */}
          {user && (
            <button className={ROW} onClick={() => setDeleting(true)}>
              <span className="text-danger">
                <IconTrash size={19} />
              </span>
              <span className="text-sm text-danger">회원 탈퇴</span>
            </button>
          )}
        </div>

        <div className="px-1 pt-1 flex flex-col gap-1">
          <div className="font-mono text-[10px] text-dim opacity-70">Booklog</div>
          {user && (
            <div className="text-xs sm:text-[13px] text-dim opacity-70 leading-relaxed">
              로그아웃해도 이 계정의 기록은 남아 있어요.
            </div>
          )}
        </div>
      </div>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onApply={(dataUrl) => {
            setCropFile(null)
            savePhoto(dataUrl)
          }}
        />
      )}

      {nameEditing && <NameEditModal current={displayName} onCancel={() => setNameEditing(false)} onSave={saveName} />}

      {emailChanging && (
        <EmailChangeModal
          current={user?.email ?? ''}
          onClose={() => setEmailChanging(false)}
          onChangeEmail={onChangeEmail}
        />
      )}

      {deleting && (
        <DeleteAccountModal
          recordCount={recordCount}
          onCancel={() => setDeleting(false)}
          onConfirm={async () => {
            await onDeleteAccount()
            setDeleting(false)
          }}
        />
      )}
    </div>
  )
}
