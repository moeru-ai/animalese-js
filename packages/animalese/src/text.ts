const breakable = /[\s\p{P}]/u
const wholeCharacter = /[\p{Script=Han}\p{Script=Hangul}]/u

/**
 * Collects streamed text and releases the part that later text cannot change. Text is
 * released up to whitespace or punctuation. In a run of Han or Hangul characters, all but
 * the last character are released too. Latin words and kana wait, because the next piece
 * can still continue a word or add a small kana.
 */
export class TextSplitter {
  #text = ''
  #released = 0

  /** The whole text so far. */
  get text(): string {
    return this.#text
  }

  /** Adds text and returns the newly released piece with its offset in the whole text. */
  push(piece: string): { text: string, offset: number } | undefined {
    this.#text += piece
    let cut = this.#released
    for (let i = this.#released + 1; i <= this.#text.length; i++) {
      const before = this.#text[i - 1]!
      const after = this.#text[i]
      if (breakable.test(before) || (after !== undefined && wholeCharacter.test(before) && wholeCharacter.test(after)))
        cut = i
    }
    return this.#release(cut)
  }

  /** Releases everything that is left. */
  flush(): { text: string, offset: number } | undefined {
    return this.#release(this.#text.length)
  }

  #release(cut: number): { text: string, offset: number } | undefined {
    if (cut <= this.#released)
      return undefined
    const piece = { text: this.#text.slice(this.#released, cut), offset: this.#released }
    this.#released = cut
    return piece
  }
}
