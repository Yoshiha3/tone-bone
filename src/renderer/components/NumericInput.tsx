import { useEffect, useState } from 'react'
import { clamp } from '@core/musicMath'

export interface NumericInputProps {
  value: number
  min: number
  max: number
  onCommit: (nextValue: number) => void
  className?: string
  testId?: string
  ariaLabel?: string
}

/**
 * Reusable bounded integer input that lets users type freely without mid-keystroke
 * clamping, committing on Enter/blur, reverting on Escape, and stepping on Up/Down.
 */
export function NumericInput({
  value,
  min,
  max,
  onCommit,
  className,
  testId,
  ariaLabel
}: NumericInputProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = (): void => {
    const trimmed = text.trim()
    const parsed = Number(trimmed)
    if (trimmed.length === 0 || !Number.isFinite(parsed)) {
      setText(String(value))
      return
    }
    const next = clamp(Math.round(parsed), min, max)
    if (next !== value) {
      onCommit(next)
    }
    setText(String(next))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setText(String(value))
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          onCommit(clamp(value + 1, min, max))
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          onCommit(clamp(value - 1, min, max))
        }
      }}
      className={className}
      data-testid={testId}
    />
  )
}
