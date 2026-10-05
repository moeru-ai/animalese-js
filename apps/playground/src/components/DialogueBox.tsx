interface DialogueBoxProps {
  name: string
  text: string
  /** Characters revealed so far, or `null` to show the whole text. */
  revealed?: number | null
}

/** The in-game speech bubble: a cream balloon with a name tag, revealing text as it is spoken. */
export function DialogueBox({ name, text, revealed = null }: DialogueBoxProps) {
  return (
    <div className="dialogue">
      <span className="dialogue-name">{name}</span>
      <p className="dialogue-text">
        {revealed === null
          ? text
          : (
              <>
                {text.slice(0, revealed)}
                <span className="dialogue-pending">{text.slice(revealed)}</span>
              </>
            )}
      </p>
    </div>
  )
}
