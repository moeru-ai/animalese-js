import type { BankIndexEntry, BankManifest, LanguageCode } from '@animalese/core'
import type { PcmBank } from '@animalese/dsp'

import { closestVoice } from '@animalese/core'
import { decodeBank } from '@animalese/dsp'

/** The voice banks of one bank directory. Banks load on first use and stay cached. */
export interface Banks {
  readonly entries: readonly BankIndexEntry[]
  /** Recorded voices that have at least one bank. */
  readonly voices: string[]
  /** The voice recorded closest to `hz`, so that a deep voice gets a deep recording. */
  voiceFor: (hz: number) => string | undefined
  /** Languages that `voice` has no bank for. */
  missing: (voice: string, languages: Iterable<LanguageCode>) => LanguageCode[]
  /** Loads the banks of `voice` for these languages. Languages without a bank are left out. */
  load: (voice: string, languages: Iterable<LanguageCode>) => Promise<PcmBank[]>
}

/** Builds `Banks` over an index and a way to load one entry, for custom storage. */
export function createBanks(entries: readonly BankIndexEntry[], loadEntry: (entry: BankIndexEntry) => Promise<PcmBank>): Banks {
  const cache = new Map<string, Promise<PcmBank>>()
  const find = (voice: string, language: LanguageCode) => entries.find(entry => entry.voice === voice && entry.language === language)
  const loadCached = (entry: BankIndexEntry): Promise<PcmBank> => {
    let pending = cache.get(entry.id)
    if (!pending) {
      pending = loadEntry(entry)
      // Forget failures so a later call can retry.
      pending.catch(() => cache.delete(entry.id))
      cache.set(entry.id, pending)
    }
    return pending
  }

  return {
    entries,
    voices: [...new Set(entries.map(entry => entry.voice))],
    voiceFor: hz => closestVoice(entries, hz),
    missing: (voice, languages) => [...new Set(languages)].filter(language => !find(voice, language)),
    load: (voice, languages) => Promise.all([...new Set(languages)].flatMap(language => find(voice, language) ?? []).map(loadCached)),
  }
}

export interface LoadBanksOptions {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

/**
 * Reads the `index.json` of a bank directory. Banks are fetched and decoded in plain
 * TypeScript, so they work in browsers, workers and Node.js without Web Audio.
 */
export async function loadBanks(indexUrl: string | URL, options: LoadBanksOptions = {}): Promise<Banks> {
  const fetcher = options.fetch ?? fetch
  const base = new URL(indexUrl, globalThis.location?.href)
  const get = async (url: URL): Promise<Response> => {
    const response = await fetcher(url)
    if (!response.ok)
      throw new Error(`failed to fetch ${url}: ${response.status}`)
    return response
  }
  const entries = await (await get(base)).json() as BankIndexEntry[]
  return createBanks(entries, async (entry) => {
    const manifestUrl = new URL(entry.manifest, base)
    const manifest = await (await get(manifestUrl)).json() as BankManifest
    return decodeBank(manifest, await (await get(new URL(manifest.sprite, manifestUrl))).arrayBuffer())
  })
}
