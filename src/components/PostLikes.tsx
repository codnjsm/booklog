import { IconHeart } from './layout/icons'

interface Props {
  count: number
  liked: boolean
  /** 좋아요를 켜고 끈다. */
  onToggle: () => void
  /** 누른 사람 목록을 연다. 아무도 안 눌렀으면 호출되지 않는다. */
  onOpenList: () => void
  busy?: boolean
}

/**
 * 게시물 카드 아래 좋아요 줄.
 *
 * 하트와 수가 하는 일이 다르다 — 하트는 켜고 끄기, 수는 누른 사람 목록 열기.
 * 같은 버튼에 묶으면 목록을 보려다 좋아요가 눌린다.
 */
export default function PostLikes({ count, liked, onToggle, onOpenList, busy }: Props) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? '좋아요 취소' : '좋아요'}
        className={`w-7 h-7 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer disabled:opacity-50 ${
          liked ? 'text-danger' : 'text-dim hover:text-ink'
        }`}
      >
        <IconHeart size={17} filled={liked} />
      </button>

      {count > 0 && (
        <button
          type="button"
          onClick={onOpenList}
          className="bg-transparent border-none p-0 px-1 py-0.5 -mx-1 text-xs sm:text-[13px] text-dim cursor-pointer hover:text-ink"
        >
          {count}명이 좋아합니다
        </button>
      )}
    </div>
  )
}
