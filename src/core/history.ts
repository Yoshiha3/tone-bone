export interface HistoryStack<T> {
  past: T[]
  present: T
  future: T[]
  maxSize: number
}

export function createHistory<T>(initial: T, maxSize = 100): HistoryStack<T> {
  return {
    past: [],
    present: initial,
    future: [],
    maxSize
  }
}

export function pushHistory<T>(stack: HistoryStack<T>, next: T): HistoryStack<T> {
  const past = [...stack.past, stack.present]
  if (past.length > stack.maxSize) {
    past.shift()
  }
  return {
    ...stack,
    past,
    present: next,
    future: []
  }
}

export function undoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.past.length === 0) return stack
  const previous = stack.past[stack.past.length - 1]
  const past = stack.past.slice(0, -1)
  return {
    ...stack,
    past,
    present: previous,
    future: [stack.present, ...stack.future]
  }
}

export function redoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.future.length === 0) return stack
  const [next, ...rest] = stack.future
  return {
    ...stack,
    past: [...stack.past, stack.present],
    present: next,
    future: rest
  }
}

export function canUndo<T>(stack: HistoryStack<T>): boolean {
  return stack.past.length > 0
}

export function canRedo<T>(stack: HistoryStack<T>): boolean {
  return stack.future.length > 0
}
