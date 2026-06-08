import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function ArchivePage() {
  const dailies = await db.daily.findMany({ orderBy: { number: 'desc' }, take: 60 })
  return (
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 16 }}>
      <h1>Archivo de dailies</h1>
      <ul>
        {dailies.map((d) => (
          <li key={d.date}>
            <Link href={`/daily/${d.date}`}>#{d.number} · {d.date} · {d.difficulty}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
