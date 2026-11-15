import type { BotAction, PlayerView } from '../../bots/botMessages'
import { createBot, type Bot, type MessagePort } from '../../bots/botClient'
import {
  chooseAction,
  considerUnoAccusation,
  defaultPersonality,
  type BotPersonality,
  type Random,
} from '../../bots/botStrategy'

export type FakeBot = Bot & { terminated: boolean; views: PlayerView[] }

// Runs the real strategy through the real message protocol, without a Worker thread.
export function inProcessBot(
  personality: BotPersonality = defaultPersonality,
  random: Random = Math.random,
): FakeBot {
  const port: MessagePort = {
    onmessage: null,
    terminate() {
      fake.terminated = true
    },
    postMessage(req) {
      fake.views.push(req.view)
      const action =
        req.type === 'chooseAction'
          ? chooseAction(req.view, personality, random)
          : considerUnoAccusation(req.playerWithOneCard, personality, random)
      queueMicrotask(() =>
        port.onmessage!({ data: { requestId: req.requestId, action } } as MessageEvent),
      )
    },
  }
  const fake: FakeBot = Object.assign(createBot(port), { terminated: false, views: [] })
  return fake
}

export function scriptedBot(
  choose: (view: PlayerView) => BotAction | Promise<BotAction>,
  consider: (view: PlayerView, playerWithOneCard: number) => BotAction = () => ({ type: 'pass' }),
): FakeBot {
  const fake: FakeBot = {
    terminated: false,
    views: [],
    async chooseAction(view) {
      fake.views.push(view)
      return choose(view)
    },
    async considerUnoAccusation(view, playerWithOneCard) {
      fake.views.push(view)
      return consider(view, playerWithOneCard)
    },
    terminate() {
      fake.terminated = true
    },
  }
  return fake
}
