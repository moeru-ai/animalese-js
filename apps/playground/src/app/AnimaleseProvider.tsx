import type { ReactNode } from 'react'
import type { AnimaleseState } from './animalese'

import { createAnimalese } from 'animalese'
import { useEffect, useState } from 'react'

import { AnimaleseContext } from './animalese'

const indexUrl = `${import.meta.env.BASE_URL}banks/index.json`

export function AnimaleseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnimaleseState>({ animalese: null, error: null })

  useEffect(() => {
    createAnimalese({ banks: new URL(indexUrl, location.href) })
      .then(animalese => setState({ animalese, error: null }))
      .catch((cause: unknown) => setState({ animalese: null, error: cause instanceof Error ? cause.message : String(cause) }))
  }, [])

  return <AnimaleseContext value={state}>{children}</AnimaleseContext>
}
