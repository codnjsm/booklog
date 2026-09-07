interface Props { size?: number }

const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
})

export const IconHome = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
)

export const IconBooks = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
  </svg>
)

export const IconCollection = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" /></svg>
)

export const IconRecords = ({ size = 18 }: Props) => (
  <svg {...base(size)}><path d="M5 20V11" /><path d="M12 20V5" /><path d="M19 20v-6" /></svg>
)

export const IconFriends = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
    <path d="M16 5.6a3 3 0 0 1 0 5.8" />
    <path d="M18.5 15.4c2 .7 2.5 2.2 2.5 4.6" />
  </svg>
)

export const IconMore = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
  </svg>
)

export const IconExport = ({ size = 16 }: Props) => (
  <svg {...base(size)}><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M4 19h16" /></svg>
)

export const IconSun = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" />
    <path d="m4.9 4.9 1.4 1.4" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" />
    <path d="m4.9 19.1 1.4-1.4" /><path d="m17.7 6.3 1.4-1.4" />
  </svg>
)

export const IconMoon = ({ size = 16 }: Props) => (
  <svg {...base(size)}><path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" /></svg>
)

export const IconSearch = ({ size = 15 }: Props) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)

export const IconSignOut = ({ size = 16 }: Props) => (
  <svg {...base(size)}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="m10 8-4 4 4 4" /><path d="M6 12h12" />
  </svg>
)

export const IconChevronRight = ({ size = 15 }: Props) => (
  <svg {...base(size)}><path d="m9 6 6 6-6 6" /></svg>
)

export const IconRefresh = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4h-4" />
  </svg>
)

export const IconLock = ({ size = 16 }: Props) => (
  <svg {...base(size)}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
)

export const IconQuote = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M6 8c-1.5 1-2.2 2.6-2.2 4.3 0 1.5.9 2.4 2 2.4s2-.9 2-2.2c0-.9-.5-1.6-1.3-1.9.2-1 .9-1.8 1.8-2.3z" />
    <path d="M15 8c-1.5 1-2.2 2.6-2.2 4.3 0 1.5.9 2.4 2 2.4s2-.9 2-2.2c0-.9-.5-1.6-1.3-1.9.2-1 .9-1.8 1.8-2.3z" />
  </svg>
)

export const IconWord = ({ size = 18 }: Props) => (
  <svg {...base(size)}>
    <path d="M4 4h6.2a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4 0l-8-8A1 1 0 0 1 4 10.2z" />
    <circle cx="8" cy="8" r="1.3" />
  </svg>
)
