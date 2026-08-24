import Link from 'next/link'
import { db } from '@/lib/db'
import { RaceMark } from '@/components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  const dailies = await db.daily.findMany({ orderBy: { number: 'desc' }, take: 60 })

  return (
    <main className="game-screen">
      <section className="game-intro">
        <RaceMark className="game-intro__mark" />
        <h1>Archivo de dailies</h1>
        <p>Vuelve a jugar desafíos anteriores en modo práctica.</p>
      </section>
      {dailies.length > 0 ? (
        <ul className="archive-list">
          {dailies.map((daily) => (
            <li key={daily.date}>
              <Link href={`/daily/${daily.date}`}>
                <span>Daily #{daily.number}</span>
                <span>{daily.date} / {daily.difficulty}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="status-panel">
          <p>Todavía no hay desafíos archivados.</p>
        </section>
      )}
    </main>
  )
}
