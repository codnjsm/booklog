import type { ReactNode } from 'react'

interface Props {
  title: string
  meta?: string
  children?: ReactNode
}

export default function PageHeader({ title, meta, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
      <div className="flex items-baseline gap-2.5">
        <h1 className="text-[19px] sm:text-[22px] font-semibold tracking-[-0.01em]">
          <span className="bg-[linear-gradient(transparent_58%,var(--highlight)_58%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">{title}</span>
        </h1>
        {meta && <span className="font-mono text-xs sm:text-[13px] text-dim">{meta}</span>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
