import { useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { SyncStatus } from '../hooks/useData'
import { useAppUI } from '../contexts/AppUIContext'
import { isStorageAtRiskBrowser } from '../lib/browser'
import { fileToSquareAvatar } from '../lib/image'
import PageHeader from './layout/PageHeader'
import {
  IconFriends,
  IconExport,
  IconSun,
  IconMoon,
  IconSignOut,
  IconChevronRight,
  IconBooks,
  IconCamera,
} from './layout/icons'

interface Props {
  user: User | null
  /** 내 프로필 사진(users 문서 기준). 없으면 이름 첫 글자 아바타를 쓴다. */
  photoURL: string
  /** 빈 문자열을 넘기면 사진을 지운다. */
  onChangePhoto: (photoURL: string) => Promise<void>
  syncStatus: SyncStatus
  incomingCount: number
  /** 게스트가 이 브라우저에만 쌓아둔 기록 수(책+문장+단어). 로그인을 권할 때 위험을 구체적으로 보여준다. */
  recordCount: number
  onExport: () => void
  onSignOut: () => void
  onSignIn: () => void
}

const ROW =
  'w-full flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl text-left cursor-pointer'

export default function MoreTab({
  user,
  photoURL,
  onChangePhoto,
  syncStatus,
  incomingCount,
  recordCount,
  onExport,
  onSignOut,
  onSignIn,
}: Props) {
  const { changeTab, theme, toggleTheme, openWelcome, showToast } = useAppUI()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoSaving, setPhotoSaving] = useState(false)

  const syncLabel = syncStatus === 'saving' ? '저장 중…' : syncStatus === 'error' ? '저장 실패' : '동기화됨'
  const syncColor = syncStatus === 'saving' ? 'bg-accent' : syncStatus === 'error' ? 'bg-danger' : 'bg-ok'

  // 사진이 없으면 바로 고르게 하고, 있을 때만 "바꿀지 지울지"를 한 번 묻는다.
  const handlePhotoClick = () => {
    if (!photoURL) {
      photoInputRef.current?.click()
      return
    }
    const remove = !confirm('확인 — 다른 사진으로 바꿉니다\n취소 — 사진을 지우고 글자 아바타로 돌아갑니다')
    if (remove) savePhoto('')
    else photoInputRef.current?.click()
  }

  const savePhoto = async (next: string) => {
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

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoSaving(true)
    try {
      const dataUrl = await fileToSquareAvatar(file)
      await onChangePhoto(dataUrl)
      showToast('프로필 사진을 바꿨어요', 'success')
    } catch {
      showToast('사진을 저장하지 못했어요', 'error')
    } finally {
      setPhotoSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="더보기" />

      <div className="flex flex-col gap-3">
        {user ? (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-xl">
            <button
              type="button"
              onClick={handlePhotoClick}
              disabled={photoSaving}
              aria-label={photoURL ? '프로필 사진 바꾸기' : '프로필 사진 추가'}
              className="relative w-11 h-11 flex-shrink-0 bg-transparent border-none p-0 cursor-pointer rounded-full disabled:opacity-60"
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
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </span>
              )}
              {/* 바꾸려는 대상(아바타) 위에 입구를 둔다. 테두리는 배경과 같은 색이라 사진에서 뱃지를 떼어내 보이게 한다. */}
              <span className="absolute -right-0.5 -bottom-0.5 w-[19px] h-[19px] rounded-full bg-accentfill text-white flex items-center justify-center border-2 border-surface">
                <IconCamera size={10} />
              </span>
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelected} className="hidden" />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="text-[15px] font-semibold">{user.displayName || '사용자'}</div>
              <div className="text-xs sm:text-[13px] text-dim truncate">{user.email}</div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface2 flex-shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${syncColor}`} />
              <span className="font-mono text-[10px] text-dim">{syncLabel}</span>
            </div>
          </div>
        ) : (
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
    </div>
  )
}
