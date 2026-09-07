import { IconStar } from './layout/icons'

interface Props {
  rating: number
  size?: number
  /** 5개 자리를 다 보여주고 남은 칸은 빈 별로 채운다 */
  showEmpty?: boolean
}

/** 별점 표시(읽기 전용). 채운 별은 부모의 글자색을 따르고, 빈 별은 border 색으로 그린다. */
export default function Stars({ rating, size = 12, showEmpty = false }: Props) {
  const filled = Math.max(0, Math.min(5, rating))
  if (filled === 0 && !showEmpty) return null

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: filled }).map((_, i) => (
        <IconStar key={`f${i}`} size={size} filled />
      ))}
      {showEmpty &&
        Array.from({ length: 5 - filled }).map((_, i) => (
          <span key={`e${i}`} className="text-border">
            <IconStar size={size} />
          </span>
        ))}
    </span>
  )
}
