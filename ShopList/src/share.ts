/** Tam liste bağlantısı (GitHub Pages tabanıyla uyumlu). */
export function listShareUrl(listId: string): string {
  let base = import.meta.env.BASE_URL
  if (!base.endsWith('/')) base += '/'
  return `${window.location.origin}${base}#/list/${listId}`
}
