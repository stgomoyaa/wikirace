interface Props {
  label: string
  placementsDone: number
}

export function RankBadge({ label, placementsDone }: Props) {
  const text = placementsDone < 5 ? `Posicionamiento ${placementsDone}/5` : label
  return <span className="rank-badge">{text}</span>
}
