import type { Banks } from 'animalese'
import type { ReactNode } from 'react'

import { errorMessageFrom } from '@moeru/std'
import { loadBanks } from 'animalese'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AnimaleseContext } from './animalese'

const indexUrl = `${import.meta.env.BASE_URL}banks/index.json`

export function AnimaleseProvider({ children }: { children: ReactNode }) {
  const [banks, setBanks] = useState<Banks | null>(null)
  const [error, setError] = useState<string | null>(null)
  const contextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    loadBanks(new URL(indexUrl, location.href))
      .then(setBanks)
      .catch((cause: unknown) => setError(errorMessageFrom(cause) ?? String(cause)))
  }, [])

  const value = useMemo(() => ({
    banks,
    error,
    audioContext: () => {
      contextRef.current ??= new AudioContext()
      if (contextRef.current.state === 'suspended')
        void contextRef.current.resume()
      return contextRef.current
    },
  }), [banks, error])

  return <AnimaleseContext value={value}>{children}</AnimaleseContext>
}
