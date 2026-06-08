interface Props {
  label: string
  placementsDone: number
}

/** Muestra el rango del jugador, o el progreso de placements si aún no termina. */
export function RankBadge({ label, placementsDone }: Props) {
  const text = placementsDone < 5 ? `Placements ${placementsDone}/5` : label
  return (
    <span
      style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: 999,
        background: '#1a1a2e', color: '#ffd166', fontWeight: 700, fontSize: 14,
      }}
    >
      {text}
    </span>
  )
}
