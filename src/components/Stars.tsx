import { IconStar } from './layout/icons'

interface Props {
  rating: number
  size?: number
  /** 5개 자리를 다 보여주고 남은 칸은 빈 별로 채운다 */
  showEmpty?: boolean
}

/** 별점 표시(읽기 전용). 채운 별은 부모의 글자색을 따르고, 빈 별은 border 색으로 그린다. 0.5 단위 반개 별도 표시한다. */
export default function Stars({ rating, size = 12, showEmpty = false }: Props) {
  const clamped = Math.round(Math.max(0, Math.min(5, rating)) * 2) / 2
  if (clamped === 0 && !showEmpty) return null

  const full = Math.floor(clamped)
  const half = clamped - full === 0.5 ? 1 : 0
  const empty = 5 - full - half

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: full }).map((_, i) => (
        <IconStar key={`f${i}`} size={size} filled />
      ))}
      {half === 1 && <IconStar key="half" size={size} filled="half" />}
      {showEmpty &&
        Array.from({ length: empty }).map((_, i) => (
          <span key={`e${i}`} className="text-border">
            <IconStar size={size} />
          </span>
        ))}
    </span>
  )
}
