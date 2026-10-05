import { useSyncExternalStore } from 'react'

/** Tracks a CSS media query, e.g. `useMediaQuery('(max-width: 720px)')`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

export const mobileQuery = '(max-width: 720px)'
