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
/**
 * 항목이 다섯이라 세로가 짧은 기기(iPhone SE 553px)에서는 한 화면에 안 들어간다.
 * 패널 전체를 스크롤시키면 인사말까지 같이 밀려 올라가므로, 세로 flex로 세워
 * 가운데 목록만 스크롤시킨다 — 인사말과 「시작하기」는 늘 제자리에 있다.
 */
const PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-[440px] sm:max-w-[500px] shadow-card max-h-full flex flex-col overflow-hidden'
const BTN =
  'w-full bg-accentfill text-white border-none font-medium py-3 rounded-lg text-sm sm:text-[15px] cursor-pointer hover:bg-accentfillhover'

interface Props {
  onClose: () => void
}

export default function WelcomeModal({ onClose }: Props) {
  return (
    <Modal onClose={onClose} labelledBy={TITLE_ID}>
      <div className={PANEL}>
        <div className="flex-shrink-0 px-6 pt-8 pb-6 text-center border-b border-border">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-accentsoft flex items-center justify-center text-accent">
            <IconBooks size={28} />
          </div>
          <h2 id={TITLE_ID} className="text-[19px] font-semibold mb-1.5">
            Booklog에 오신 걸 환영해요
          </h2>
          <p className="text-dim text-sm leading-relaxed">읽은 책과 문장을 기록하고, 친구와 나눠보세요</p>
        </div>
        {/* min-h-0이 없으면 flex 자식이 내용 높이 아래로 못 줄어들어 스크롤이 생기지 않는다. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-auto px-6 py-5 flex flex-col gap-4">
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
        {/* 목록이 이 선에서 잘린다. 인사말 아래 선과 짝을 이뤄 잘린 자리가 경계로 읽히게 한다. */}
        <div className="flex-shrink-0 border-0 border-t border-border px-6 pb-6 pt-4">
          <button className={BTN} onClick={onClose}>
            시작하기
          </button>
        </div>
      </div>
    </Modal>
  )
}
