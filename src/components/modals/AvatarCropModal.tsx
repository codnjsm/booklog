import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { loadImage, cropToAvatar } from '../../lib/image'

const MODAL_PANEL =
  'bg-surface border border-border rounded-2xl w-full max-w-full sm:max-w-[400px] max-h-[92%] sm:max-h-[90%] overflow-y-auto overscroll-contain touch-auto shadow-card'
const MODAL_HEADER =
  'sticky top-0 z-10 bg-surface pt-3.5 px-[18px] pb-3 sm:pt-[22px] sm:px-6 sm:pb-4 border-b border-border flex justify-between items-center'
const MODAL_CLOSE = 'bg-transparent border-none text-dim text-lg cursor-pointer leading-none px-2 py-1 hover:text-ink'
const MODAL_BODY = 'px-[18px] py-3.5 sm:px-6 sm:py-[22px]'
const MODAL_ACTIONS = 'flex gap-2 justify-end px-[18px] py-3 sm:px-6 sm:py-4 border-t border-border'
const BTN =
  'bg-accentfill text-white border-none px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-accentfillhover disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY =
  'bg-surface text-ink border border-border px-4 py-2.5 rounded-lg text-[13px] sm:text-sm cursor-pointer hover:bg-surface2'
const TITLE_ID = 'avatar-crop-modal-title'

/** 미리보기 정사각 영역의 한 변(px). 실제 저장은 항상 128px이라 이 값은 조작 편의용이다. */
const VIEW = 260
const MAX_ZOOM = 3

interface Props {
  file: File
  onCancel: () => void
  onApply: (dataUrl: string) => void
}

export default function AvatarCropModal({ file, onCancel, onApply }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  // 이미지를 미리보기 영역 좌상단 기준으로 얼마나 밀어둘지(px). 항상 음수이거나 0이다.
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    let revoke: (() => void) | null = null
    loadImage(file)
      .then((r) => {
        revoke = r.revoke
        setImg(r.img)
      })
      .catch(() => setError(true))
    return () => revoke?.()
  }, [file])

  // 짧은 변이 미리보기를 꽉 채우는 배율. 여기에 zoom을 곱한 게 실제 표시 크기다.
  const base = img ? VIEW / Math.min(img.width, img.height) : 1
  const k = base * zoom
  const drawW = img ? img.width * k : 0
  const drawH = img ? img.height * k : 0

  // 이미지가 미리보기를 항상 덮도록 이동 범위를 가둔다. 안 그러면 빈 공간이 생긴다.
  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(VIEW - drawW, x)),
    y: Math.min(0, Math.max(VIEW - drawH, y)),
  })

  // 확대/축소는 미리보기 중심을 기준으로 한다 — 손가락 위치와 무관하게 보던 곳이 유지된다.
  const handleZoom = (next: number) => {
    if (!img) return
    const prevK = base * zoom
    const nextK = base * next
    const cx = (VIEW / 2 - offset.x) / prevK
    const cy = (VIEW / 2 - offset.y) / prevK
    setZoom(next)
    setOffset(
      (() => {
        const nx = VIEW / 2 - cx * nextK
        const ny = VIEW / 2 - cy * nextK
        const w = img.width * nextK
        const h = img.height * nextK
        return { x: Math.min(0, Math.max(VIEW - w, nx)), y: Math.min(0, Math.max(VIEW - h, ny)) }
      })(),
    )
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    setOffset(clamp(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py)))
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const handleApply = () => {
    if (!img) return
    // 미리보기에 보이는 사각형을 원본 픽셀 좌표로 되돌린다.
    const sx = -offset.x / k
    const sy = -offset.y / k
    const size = VIEW / k
    onApply(cropToAvatar(img, { sx, sy, size }))
  }

  return (
    <Modal onClose={onCancel} labelledBy={TITLE_ID}>
      <div className={MODAL_PANEL}>
        <div className={MODAL_HEADER}>
          <h3 id={TITLE_ID} className="font-sans text-base font-semibold">
            사진 편집
          </h3>
          <button className={MODAL_CLOSE} onClick={onCancel} aria-label="닫기">
            ×
          </button>
        </div>

        <div className={MODAL_BODY}>
          {error ? (
            <p className="text-[13px] sm:text-sm text-danger py-6 text-center">사진을 불러오지 못했어요</p>
          ) : (
            <>
              <div
                className="relative mx-auto overflow-hidden rounded-xl bg-surface2 touch-none select-none cursor-grab active:cursor-grabbing"
                style={{ width: VIEW, height: VIEW, maxWidth: '100%' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {img && (
                  <img
                    src={img.src}
                    alt=""
                    draggable={false}
                    className="absolute left-0 top-0 max-w-none"
                    style={{ width: drawW, height: drawH, transform: `translate(${offset.x}px, ${offset.y}px)` }}
                  />
                )}
                {/* 실제로 저장되는 건 이 원 안쪽. 원형 요소에 바깥쪽 그림자를 크게 줘서 원 바깥만 어둡게 덮는다
                    (부모가 overflow-hidden이라 그림자가 미리보기 밖으로는 안 번진다). */}
                <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/70 [box-shadow:0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>

              <div className="flex items-center gap-3 mt-4">
                <span className="text-xs sm:text-[13px] text-dim flex-shrink-0">확대</span>
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => handleZoom(Number(e.target.value))}
                  aria-label="확대 배율"
                  className="flex-1 accent-accent cursor-pointer"
                />
              </div>
              <p className="text-xs sm:text-[13px] text-dim mt-2.5 text-center">
                드래그해서 위치를 맞추고, 원 안에 담길 부분을 정해주세요
              </p>
            </>
          )}
        </div>

        <div className={MODAL_ACTIONS}>
          <button className={BTN_SECONDARY} onClick={onCancel}>
            취소
          </button>
          <button className={BTN} onClick={handleApply} disabled={!img || error}>
            적용
          </button>
        </div>
      </div>
    </Modal>
  )
}
