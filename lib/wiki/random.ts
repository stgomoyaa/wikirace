/** Devuelve el título de un artículo aleatorio (namespace 0). */
export async function randomTitle(
  lang: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`
  const res = await fetchImpl(url)
  if (!(res as Response).ok) throw new Error('random failed')
  const data = await (res as Response).json()
  return data.query.random[0].title as string
}
