import Link from 'next/link'

export function RaceMark({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 50 50"
    >
      <path d="m27 39 18-14-18-14v28ZM5 39l18-14L5 11v28Z" />
    </svg>
  )
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="WikiRace, ir al inicio">
          <RaceMark className="brand__mark" />
          <span>WikiRace</span>
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
