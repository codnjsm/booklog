import { IconBooks, IconCollection, IconRecords, IconFriends, IconBell } from '../layout/icons'
import Modal from './Modal'

// 탭 넷과 알림 하나. 알림은 탭이 아니지만 여기 넣는다 —
// 더보기에 들어가 보지 않으면 알림을 켤 수 있다는 걸 알 길이 없다.
const FEATURES = [
  { Icon: IconBooks, title: '서재', desc: '책을 검색해서 추가하고, 읽고싶음·읽는중·완독으로 정리해보세요' },
  { Icon: IconCollection, title: '모음', desc: '마음에 남은 문장을 저장하고, 사진으로 바로 옮겨 담을 수도 있어요' },
  {
    Icon: IconRecords,
    title: '기록',
    desc: '독서 목표를 세우고 달력·통계로 습관을 확인하고, 친구와 챌린지도 해보세요',
  },
  { Icon: IconFriends, title: '친구', desc: '책장을 공유하고, 문장에 좋아요·댓글을 남기고, 읽은 책을 권해보세요' },
  {
    Icon: IconBell,
    title: '알림',
    desc: '친구의 반응과 챌린지 소식이 알림으로 와요. 홈 화면에 추가하면 앱을 열지 않아도 받을 수 있어요',
  },
]

const TITLE_ID = 'welcome-modal-title'
/** 항목이 다섯이라 세로가 짧은 기기(iPhone SE 553px)에서는 한 화면에 안 들어간다.
 *  다른 모달과 같이 높이를 제한하고 안에서 스크롤시킨다 — 안 그러면 「시작하기」가 화면 밖으로 나간다. */
const PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-[440px] sm:max-w-[500px] shadow-card max-h-full overflow-y-auto overscroll-contain touch-auto'
const BTN =
  'w-full bg-accentfill text-white border-none font-medium py-3 rounded-lg text-sm sm:text-[15px] cursor-pointer hover:bg-accentfillhover'

interface Props {
  onClose: () => void
}

export default function WelcomeModal({ onClose }: Props) {
  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={PANEL}>
        <div className="px-6 pt-8 pb-6 text-center border-b border-border">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-accentsoft flex items-center justify-center text-accent">
            <IconBooks size={28} />
          </div>
          <h2 id={TITLE_ID} className="text-[19px] font-semibold mb-1.5">
            Booklog에 오신 걸 환영해요
          </h2>
          <p className="text-dim text-sm leading-relaxed">읽은 책과 문장을 기록하고, 친구와 나눠보세요</p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-surface2 flex items-center justify-center text-accent flex-shrink-0">
                <Icon size={18} />
              </span>
              <div>
                <div className="text-sm font-medium text-ink mb-0.5">{title}</div>
                <div className="text-xs sm:text-[13px] text-dim leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        {/* 스크롤이 생기는 화면에서도 시작하기가 늘 보이게 아래에 붙여둔다.
            밑에서 내용이 비쳐 보이면 안 되므로 배경을 깐다. */}
        <div className="sticky bottom-0 bg-surface px-6 pb-6 pt-3">
          <button className={BTN} onClick={onClose}>
            시작하기
          </button>
        </div>
      </div>
    </Modal>
  )
}
