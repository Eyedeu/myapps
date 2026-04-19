export type Route =
  | { name: 'home' }
  | { name: 'list'; listId: string }

const LIST_RE = /^#\/(?:list|l)\/([0-9a-f-]{36})$/i

export function parseHash(hash: string): Route {
  const h = hash.startsWith('#') ? hash : `#${hash}`
  const m = h.match(LIST_RE)
  if (m?.[1]) return { name: 'list', listId: m[1].toLowerCase() }
  return { name: 'home' }
}

export function listHash(listId: string): string {
  return `#/list/${listId}`
}

export function readRoute(): Route {
  return parseHash(window.location.hash || '#/')
}

export function navigateTo(route: Route): void {
  if (route.name === 'home') {
    window.location.hash = '#/'
    return
  }
  window.location.hash = listHash(route.listId)
}
