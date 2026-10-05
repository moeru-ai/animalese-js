import type { BankIndexEntry, LanguageCode } from '@animalese/core'

import type { BankSet, FetchOptions, LoadedBank } from './bank.ts'

import { closestVoice } from '@animalese/core'

import { loadBank, loadBankIndex } from './bank.ts'

export interface BankLibraryOptions extends FetchOptions {
  /**
   * Context used to decode sprites. Defaults to a small `OfflineAudioContext`, so banks can
   * be loaded before the user gesture an `AudioContext` needs. Decoded buffers play in any context.
   */
  context?: BaseAudioContext
}

/**
 * The banks listed in one `index.json`: which voices exist, which one suits a pitch, and
 * loading (once) the banks a piece of text needs.
 */
export class BankLibrary {
  readonly entries: readonly BankIndexEntry[]
  readonly #baseUrl: URL
  readonly #options: BankLibraryOptions
  readonly #cache = new Map<string, Promise<LoadedBank>>()
  #context?: BaseAudioContext

  constructor(entries: readonly BankIndexEntry[], baseUrl: string | URL, options: BankLibraryOptions = {}) {
    this.entries = entries
    this.#baseUrl = new URL(baseUrl, globalThis.location?.href)
    this.#options = options
  }

  /** Loads `index.json` and returns a library for it. */
  static async fromIndex(indexUrl: string | URL, options: BankLibraryOptions = {}): Promise<BankLibrary> {
    const url = new URL(indexUrl, globalThis.location?.href)
    return new BankLibrary(await loadBankIndex(url, options), url, options)
  }

  /** Voice names that have at least one bank. */
  get voices(): string[] {
    return [...new Set(this.entries.map(entry => entry.voice))]
  }

  /** The voice recorded closest to `hz`; deep voices get deep recordings. */
  voiceFor(hz: number): string | undefined {
    return closestVoice(this.entries, hz)
  }

  /** Languages of `voice` that have no bank. */
  missing(voice: string, languages: Iterable<LanguageCode>): LanguageCode[] {
    return [...new Set(languages)].filter(language => !this.#find(voice, language))
  }

  /** Loads the banks of `voice` for these languages, skipping languages it has no bank for. */
  async load(voice: string, languages: Iterable<LanguageCode>): Promise<BankSet> {
    const entries = [...new Set(languages)].flatMap(language => this.#find(voice, language) ?? [])
    const banks = await Promise.all(entries.map(entry => this.loadEntry(entry)))
    return Object.fromEntries(banks.map(bank => [bank.manifest.language, bank]))
  }

  /** Loads one bank, sharing the request with concurrent and later calls. */
  loadEntry(entry: BankIndexEntry): Promise<LoadedBank> {
    let pending = this.#cache.get(entry.id)
    if (!pending) {
      this.#context ??= this.#options.context ?? new OfflineAudioContext(1, 1, 44100)
      pending = loadBank(this.#context, new URL(entry.manifest, this.#baseUrl), this.#options)
      // Forget failures so a later call can retry.
      pending.catch(() => this.#cache.delete(entry.id))
      this.#cache.set(entry.id, pending)
    }
    return pending
  }

  #find(voice: string, language: LanguageCode): BankIndexEntry | undefined {
    return this.entries.find(entry => entry.voice === voice && entry.language === language)
  }
}
