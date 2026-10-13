import Modal from './Modal'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[420px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const TITLE_ID = 'post-likes-modal-title'

export interface Liker {
  displayName: string
  photoURL: string
  /** 나와 친구인 사람만 true. false면 서버가 이름을 보내지 않는다. */
  known: boolean
}

interface Props {
  likers: Liker[] | null
  onClose: () => void
}

function Avatar({ liker }: { liker: Liker }) {
  if (liker.known && liker.photoURL) {
    return (
      <img
        src={liker.photoURL}
        referrerPolicy="no-referrer"
        alt=""
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  return (
    <span
      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${
        liker.known ? 'bg-accentfill text-white' : 'bg-surface2 text-dim'
      }`}
    >
      {liker.known ? (liker.displayName || '?')[0].toUpperCase() : '·'}
    </span>
  )
}

export default function PostLikesModal({ likers, onClose }: Props) {
  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-semibold">
            좋아요
          </h3>
          <button type="button" className={MODAL_CLOSE} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={MODAL_BODY}>
          {likers === null ? (
            <div className="flex flex-col gap-3 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface2" />
                  <div className="h-3 w-24 rounded bg-surface2" />
                </div>
              ))}
            </div>
          ) : likers.length === 0 ? (
            <div className="py-6 text-center text-xs sm:text-[13px] text-dim">아직 아무도 누르지 않았어요</div>
          ) : (
            <div className="flex flex-col">
              {likers.map((l, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-surface2 last:border-b-0">
                  <Avatar liker={l} />
                  {/* 친구가 아닌 사람은 서버가 이름을 보내지 않는다. 있는 척 비워두지 않고 이렇게 적는다. */}
                  <span className={`text-sm ${l.known ? 'text-ink' : 'text-dim'}`}>
                    {l.known ? l.displayName || '이름 없음' : '내가 모르는 친구'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
