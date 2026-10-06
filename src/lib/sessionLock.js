// Presentation/operation gate, not offline authorization or a replacement for RLS.
export function createSessionLock({ foreground = true } = {}) {
  let state = { locked: true, foreground, userId: null, reason: 'startup', operations: 0 }
  let lockEpoch = 0
  let operationEpoch = 0
  const listeners = new Set()
  const operations = new Set()
  const publish = patch => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }
  const canOperate = userId => Boolean(userId && state.userId === userId && !state.locked && state.foreground)
  const lock = (reason = 'manual') => {
    lockEpoch += 1; operationEpoch += 1
    publish({ locked: true, reason })
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    lock,
    canOperate,
    bindUser(userId) {
      const nextId = userId || null
      if (state.userId === nextId) return
      operationEpoch += 1
      publish({ userId: nextId, locked: true, reason: 'account' })
    },
    setForeground(next) {
      if (state.foreground === next) return
      if (!next) lock('background')
      publish({ foreground: next })
    },
    beginUnlock() {
      if (!state.foreground) return null
      lock('unlock')
      return { epoch: lockEpoch }
    },
    finishUnlock(ticket, userId) {
      if (!ticket || ticket.epoch !== lockEpoch || !state.foreground || !userId || state.userId !== userId) return false
      operationEpoch += 1
      publish({ locked: false, reason: null })
      return true
    },
    operationGuard(userId) {
      const epoch = operationEpoch
      return () => epoch === operationEpoch && canOperate(userId)
    },
    beginOperation(userId) {
      if (!canOperate(userId)) return null
      let done
      const promise = new Promise(resolve => { done = resolve })
      operations.add(promise)
      publish({ operations: operations.size })
      return () => {
        if (!operations.delete(promise)) return
        done()
        publish({ operations: operations.size })
      }
    },
    async waitForOperations(timeoutMs = 15000) {
      if (!operations.size) return
      let timer
      try {
        await Promise.race([
          Promise.all([...operations]),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Wait for the current order action to finish before changing sessions.')), timeoutMs)
          }),
        ])
      } finally { clearTimeout(timer) }
    },
  }
}
