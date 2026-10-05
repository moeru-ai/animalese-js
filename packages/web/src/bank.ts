import type { BankIndexEntry, BankManifest, LanguageCode } from '@animalese/core'

/** A bank whose sprite is decoded into an `AudioBuffer`. */
export interface LoadedBank {
  manifest: BankManifest
  buffer: AudioBuffer
}

/** Loaded banks keyed by the language they voice. */
export type BankSet = Partial<Record<LanguageCode, LoadedBank>>

export interface FetchOptions {
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

/** Fetches a bank's manifest and sprite and decodes the sprite with `context`. */
export async function loadBank(context: BaseAudioContext, manifestUrl: string | URL, options: FetchOptions = {}): Promise<LoadedBank> {
  const fetcher = options.fetch ?? fetch
  const url = new URL(manifestUrl, globalThis.location?.href)
  const manifest = await expectOk(await fetcher(url)).json() as BankManifest
  const sprite = await expectOk(await fetcher(new URL(manifest.sprite, url))).arrayBuffer()
  return { manifest, buffer: await context.decodeAudioData(sprite) }
}

/** Fetches a bank directory's `index.json`. */
export async function loadBankIndex(indexUrl: string | URL, options: FetchOptions = {}): Promise<BankIndexEntry[]> {
  const fetcher = options.fetch ?? fetch
  return await expectOk(await fetcher(new URL(indexUrl, globalThis.location?.href))).json() as BankIndexEntry[]
}

function expectOk(response: Response): Response {
  if (!response.ok)
    throw new Error(`failed to fetch ${response.url}: ${response.status}`)
  return response
}
