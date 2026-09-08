import type { Post } from '../types'
import { relativeDay } from '../lib/insights'
import HighlightedText from './HighlightedText'

const STATUS_BADGE = {
  wishlist: { label: '읽고싶음', cls: 'border border-border text-dim' },
  reading: { label: '읽는중', cls: 'border border-ink text-ink' },
  done: { label: '완독', cls: 'bg-accent text-white' },
}

function Avatar({ url, name }: { url?: string; name: string }) {
  if (url) {
    return (
      <img className="w-7 h-7 rounded-full object-cover flex-shrink-0" src={url} referrerPolicy="no-referrer" alt="" />
    )
  }
  return (
    <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-accent text-white font-semibold text-xs">
      {(name || '?')[0].toUpperCase()}
    </span>
  )
}

interface Props {
  post: Post
  isOwn: boolean
  onDelete: () => void
}

export default function PostCard({ post, isOwn, onDelete }: Props) {
  const { attachment } = post

  return (
    <div className="bg-surface border border-border rounded-[10px] px-4 py-3.5 sm:px-[22px] sm:py-5">
      <div className="flex items-center gap-2 mb-3">
        <Avatar url={post.authorPhotoURL} name={post.authorDisplayName} />
        <span className="text-sm font-medium text-ink">{post.authorDisplayName || '이름 없음'}</span>
        <span className="font-mono text-xs sm:text-[13px] text-dim ml-auto">{relativeDay(post.createdAt)}</span>
        {isOwn && (
          <button
            onClick={onDelete}
            aria-label="게시물 삭제"
            className="w-[26px] h-[26px] flex-shrink-0 flex items-center justify-center rounded-md bg-transparent text-danger border border-border cursor-pointer hover:bg-danger/10"
          >
            ×
          </button>
        )}
      </div>

      {attachment.kind === 'quote' ? (
        <div className="bg-surface2 rounded-lg px-3.5 py-3">
          <div className="font-serif text-sm sm:text-[15px] leading-[1.8] text-ink">
            &ldquo;
            <HighlightedText text={attachment.quoteText} highlights={attachment.quoteHighlights ?? undefined} />
            &rdquo;
          </div>
          {attachment.bookTitle && (
            <div className="text-xs sm:text-[13px] text-dim mt-2">
              {attachment.bookTitle}
              {attachment.bookAuthor ? ` · ${attachment.bookAuthor}` : ''}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2.5 bg-surface2 rounded-lg p-2.5">
          <div className="w-11 h-16 rounded bg-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
            {attachment.bookCover ? (
              <img src={attachment.bookCover} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] text-dim text-center px-0.5 leading-tight">{attachment.bookTitle}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink truncate">{attachment.bookTitle}</div>
            <div className="text-xs sm:text-[13px] text-dim truncate mt-0.5">{attachment.bookAuthor}</div>
            <span
              className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 ${STATUS_BADGE[attachment.bookStatus].cls}`}
            >
              {STATUS_BADGE[attachment.bookStatus].label}
            </span>
          </div>
        </div>
      )}

      <div className="text-xs sm:text-[13px] text-dim italic border-l-2 border-border pl-2.5 mt-3 leading-relaxed">
        {post.caption}
      </div>
    </div>
  )
}
