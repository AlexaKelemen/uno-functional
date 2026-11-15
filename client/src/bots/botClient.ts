// Main-thread side of a bot. Wraps the worker's callback-style messages in Promises,
// matching each response to its request by requestId.
import type { BotAction, BotRequest, BotResponse, PlayerView } from '@/shared/gameTypes'

export interface Bot {
  chooseAction(view: PlayerView): Promise<BotAction>
  considerUnoAccusation(view: PlayerView, playerWithOneCard: number): Promise<BotAction>
  terminate(): void
}

// The minimal piece of the Worker API we rely on - lets tests swap in a fake.
export interface MessagePort {
  postMessage(message: BotRequest): void
  onmessage: ((event: MessageEvent<BotResponse>) => void) | null
  terminate(): void
}

export function createWorker(): MessagePort {
  return new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' })
}

// Distributes Omit over each member of the union (a plain Omit would collapse it).
type WithoutId<T> = T extends unknown ? Omit<T, 'requestId'> : never

export function createBot(port: MessagePort = createWorker()): Bot {
  const pending = new Map<number, (action: BotAction) => void>()
  let nextRequestId = 0

  port.onmessage = ({ data }) => {
    const resolve = pending.get(data.requestId)
    pending.delete(data.requestId)
    resolve?.(data.action)
  }

  function request(message: WithoutId<BotRequest>): Promise<BotAction> {
    const requestId = nextRequestId++
    return new Promise((resolve) => {
      pending.set(requestId, resolve)
      port.postMessage({ ...message, requestId } as BotRequest)
    })
  }

  return {
    chooseAction: (view) => request({ type: 'chooseAction', view }),
    considerUnoAccusation: (view, playerWithOneCard) =>
      request({ type: 'considerUnoAccusation', view, playerWithOneCard }),
    terminate: () => port.terminate(),
  }
}
