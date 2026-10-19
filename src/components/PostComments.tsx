import { useState } from 'react'
import type { Comment } from '../types'
import { relativeDay } from '../lib/insights'

const INPUT =
  'flex-1 min-w-0 bg-bg border border-border text-ink px-3 py-2 rounded-[7px] text-[13px] font-sans placeholder:text-dim placeholder:opacity-50'
const SEND =
  'bg-accentsoft text-accent border-none font-medium px-3 py-2 rounded-lg text-[13px] cursor-pointer flex-shrink-0 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed'

function Avatar({ url, name }: { url?: string; name: string }) {
  if (url)
    return (
      <img
        loading="lazy"
        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        src={url}
        referrerPolicy="no-referrer"
        alt=""
      />
    )
  return (
    <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center bg-accentfill text-white font-semibold text-[10px]">
      {(name || '?')[0].toUpperCase()}
    </span>
  )
}

interface Props {
  count: number
  /** 펼쳐졌는지. 펼치기 전에는 목록을 부르지 않는다. */
  open: boolean
  comments: Comment[] | null
  /** 내 uid. 지우기를 보여줄지 정한다. */
  myUid: string
  /** 이 글이 내 글인지. 글쓴이는 남의 댓글도 지울 수 있다. */
  isOwnPost: boolean
  onToggle: () => void
  onAdd: (text: string) => Promise<void>
  onDelete: (commentId: string) => void
  busy?: boolean
}

/**
 * 게시물 카드의 댓글 줄.
 *
 * **댓글이 없으면 수를 보여주지 않는다.** 「댓글 0」이 눈에 보이면 글쓴이가 위축된다.
 * 좋아요는 안 눌려도 티가 덜 나지만 이건 드러난다.
 */
export default function PostComments({
  count,
  open,
  comments,
  myUid,
  isOwnPost,
  onToggle,
  onAdd,
  onDelete,
  busy,
}: Props) {
  const [text, setText] = useState('')
  const valid = text.trim().length > 0 && text.trim().length <= 300

  const submit = async () => {
    if (!valid || busy) return
    const body = text.trim()
    setText('')
    try {
      await onAdd(body)
    } catch {
      setText(body) // 실패하면 쓰던 글을 돌려준다
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="bg-transparent border-none px-1.5 py-1.5 -mx-1.5 text-xs sm:text-[13px] text-dim cursor-pointer hover:text-ink"
      >
        {count > 0 ? `댓글 ${count}` : '댓글 쓰기'}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2.5">
          {comments === null ? (
            <div className="text-xs text-dim">불러오는 중…</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar url={c.authorPhotoURL} name={c.authorDisplayName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[13px] font-medium text-ink truncate">
                      {c.authorDisplayName || '이름 없음'}
                    </span>
                    <span className="font-mono text-[11px] text-dim flex-shrink-0">{relativeDay(c.createdAt)}</span>
                  </div>
                  {/* 긴 댓글이 카드를 넘지 않게 줄바꿈한다. */}
                  <div className="text-[13px] text-ink leading-[1.6] whitespace-pre-wrap break-words mt-0.5">
                    {c.text}
                  </div>
                </div>
                {(c.authorUid === myUid || isOwnPost) && (
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label="댓글 삭제"
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-transparent border-none text-dim text-xs cursor-pointer hover:text-danger"
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}

          <div className="flex gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submit()
              }}
              placeholder="댓글을 남겨보세요"
              maxLength={300}
              className={INPUT}
            />
            <button type="button" onClick={() => void submit()} disabled={!valid || busy} className={SEND}>
              남기기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
