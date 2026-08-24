import Link from 'next/link'

export function RaceMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 50 50"
    >
      <path d="M7 34 22 17l21 15" />
      <circle cx="7" cy="34" r="3.5" />
      <circle cx="22" cy="17" r="3.5" />
      <circle cx="43" cy="32" r="3.5" />
    </svg>
  )
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="WikiRace, ir al inicio">
          <RaceMark className="brand__mark" />
          <span>Wiki<span className="brand__slash">/</span>Race</span>
        </Link>
        <nav className="site-nav" aria-label="Modos de juego">
          <Link href="/daily">Daily</Link>
          <Link href="/play">Práctica</Link>
          <Link href="/ranked">Ranked</Link>
          <Link href="/archive">Archivo</Link>
        </nav>
      </div>
    </header>
  )
}
