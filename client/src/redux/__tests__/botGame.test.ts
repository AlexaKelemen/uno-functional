import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as _ from 'lodash/fp'
import { isWild } from '@model/deck'
import * as Round from '@model/round'
import type { BotAction, PlayerView } from '../../bots/botMessages'
import { createConnection } from '../../api/connection'
import { makeStore } from '../store'
import { HUMAN, type LocalGameState, type RoundState } from '../slices/localGameSlice'
import { createLocalGameThunks } from '../thunks/localGame'
import { selectCanPlayCard, selectLocalView } from '../selectors'
import { fakeGameServer } from './fakeGameServer'
import { inProcessBot, scriptedBot, type FakeBot } from './fakeBots'

const thinkMs = 1000

const seededRandom = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(7))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setUp(makeBot: (seat: number) => FakeBot, botCount: 1 | 2 | 3 = 3) {
  const store = makeStore(createConnection(() => fakeGameServer()))
  const bots: FakeBot[] = []
  const thunks = createLocalGameThunks({
    thinkMs,
    createBot: (seat) => {
      const bot = makeBot(seat)
      bots.push(bot)
      return bot
    },
  })
  const states: LocalGameState[] = []
  store.subscribe(() => states.push(store.getState().localGame))
  const local = () => store.getState().localGame
  const round = () => local().round!
  const start = () => store.dispatch(thunks.startLocalGame({ playerName: 'Ann', botCount }))
  return { store, thunks, bots, states, local, round, start }
}

type Setup = ReturnType<typeof setUp>

function humanMove({ store, thunks }: Setup) {
  const view = selectLocalView(store.getState())!
  const index = view.hand.findIndex((_card, i) => selectCanPlayCard(view, i))
  if (index === -1) return store.dispatch(thunks.drawLocal())
  return store.dispatch(thunks.playLocal(index, isWild(view.hand[index]!) ? 'RED' : undefined))
}

const humansTurn = (g: Setup) => g.round().playerInTurn === HUMAN && !g.local().botsThinking

async function play(g: Setup, steps: number) {
  for (let step = 0; step < steps && g.round().playerInTurn !== undefined; step++) {
    if (humansTurn(g)) void humanMove(g)
    await vi.advanceTimersByTimeAsync(thinkMs)
  }
}

async function untilBotInTurn(g: Setup) {
  await vi.advanceTimersByTimeAsync(0)
  while (g.round().playerInTurn === HUMAN) {
    void humanMove(g)
    await vi.advanceTimersByTimeAsync(0)
  }
}

const cardsIn = (round: RoundState) =>
  _.flatten(round.hands).length + round.drawPile.length + round.discardPile.length

const roundChanges = (states: readonly LocalGameState[]) =>
  states.filter((state, i) => i === 0 || state.round !== states[i - 1]!.round)

const alwaysDraw = () => scriptedBot(() => ({ type: 'draw' }))

describe('bot runner', () => {
  it('plays a full game against three bots to a winner', async () => {
    const g = setUp(() => inProcessBot())
    g.start()
    await play(g, 5000)

    const round = g.round()
    const winner = Round.winner(round as Round.Round)
    expect(winner).toBeDefined()
    expect(round.hands[winner!]).toEqual([])
    expect(cardsIn(round)).toBe(108)
    expect(g.local().botsThinking).toBe(false)
    expect(g.local().error).toBe('')
    expect(g.bots.map((bot) => bot.terminated)).toEqual([true, true, true])
  })

  it('waits thinkMs before a bot moves, and flags the bots as thinking', async () => {
    const g = setUp(alwaysDraw)
    g.start()
    await untilBotInTurn(g)
    const moves = g.local().moves
    expect(g.local().botsThinking).toBe(true)

    await vi.advanceTimersByTimeAsync(thinkMs - 1)
    expect(g.local().moves).toBe(moves)
    await vi.advanceTimersByTimeAsync(1)
    expect(g.local().moves).toBeGreaterThan(moves)
  })

  it('runs only one loop at a time', async () => {
    const g = setUp(alwaysDraw)
    g.start()
    await untilBotInTurn(g)
    expect(g.store.dispatch(g.thunks.runBots())).toBe(g.store.dispatch(g.thunks.runBots()))

    const asked = _.sumBy((bot: FakeBot) => bot.views.length, g.bots)
    await vi.advanceTimersByTimeAsync(thinkMs)
    expect(_.sumBy((bot: FakeBot) => bot.views.length, g.bots) - asked).toBeLessThanOrEqual(2)
  })

  it('hands the turn back to the human and stops thinking', async () => {
    const g = setUp(alwaysDraw)
    let done = false
    void g.start().then(() => (done = true))
    for (let step = 0; step < 20 && !done; step++) await vi.advanceTimersByTimeAsync(thinkMs)
    expect(done).toBe(true)
    expect(g.round().playerInTurn).toBe(HUMAN)
    expect(g.local().botsThinking).toBe(false)
  })

  const illegal: Record<string, (view: PlayerView) => BotAction> = {
    'a card that is not in the hand': () => ({ type: 'play', cardIndex: 99, sayUno: false }),
    'a card that does not match': (view) => ({
      type: 'play',
      cardIndex: _.findIndex((i: number) => !selectCanPlayCard(view, i), _.range(0, view.hand.length)),
      sayUno: false,
    }),
  }

  it.each(Object.keys(illegal))('turns a play of %s into a draw', async (name) => {
    const g = setUp(() => scriptedBot(illegal[name]!))
    g.start()
    await untilBotInTurn(g)
    const before = g.round()
    const seat = before.playerInTurn!
    const seen = g.states.length

    await vi.advanceTimersByTimeAsync(thinkMs)
    const [first] = roundChanges(g.states.slice(seen)).filter((state) => state.round !== before)
    expect(first!.round!.hands[seat]).toHaveLength(before.hands[seat]!.length + 1)
    expect(first!.round!.discardPile).toEqual(before.discardPile)
    expect(g.local().error).toBe('')
  })

  it('never lets a bot name a color that does not exist', async () => {
    const colorblind = () =>
      scriptedBot((view): BotAction => {
        const wild = view.hand.findIndex((card, i) => isWild(card) && selectCanPlayCard(view, i))
        const cardIndex = wild === -1 ? view.hand.length - 1 : wild
        return { type: 'play', cardIndex, color: 'PURPLE' as 'RED', sayUno: false }
      })
    const g = setUp(colorblind)
    g.start()
    await play(g, 400)

    const rounds = roundChanges(g.states).map((state) => state.round!)
    const wildsByBots = rounds.filter(
      (round, i) => i > 0 && isWild(round.discardPile[0]!) && rounds[i - 1]!.playerInTurn !== HUMAN,
    )
    expect(wildsByBots.length).toBeGreaterThan(0)
    expect(rounds.every((round) => ['BLUE', 'GREEN', 'RED', 'YELLOW'].includes(round.currentColor))).toBe(true)
  })

  it('ignores a late answer from a bot of the previous game', async () => {
    let answer: ((action: BotAction) => void) | undefined
    let firstGame = true
    const g = setUp(() =>
      firstGame ? scriptedBot(() => new Promise<BotAction>((resolve) => (answer = resolve))) : alwaysDraw(),
    )
    g.start()
    await untilBotInTurn(g)
    const seat = g.round().playerInTurn!
    await vi.advanceTimersByTimeAsync(thinkMs)
    expect(answer).toBeDefined()

    firstGame = false
    g.start()
    for (let step = 0; step < 5000 && g.round().playerInTurn !== seat; step++) {
      if (humansTurn(g)) void humanMove(g)
      await vi.advanceTimersByTimeAsync(thinkMs / 10)
    }
    const before = g.round()
    expect(before.playerInTurn).toBe(seat)

    answer!({ type: 'draw' })
    await vi.advanceTimersByTimeAsync(0)
    expect(g.round()).toBe(before)
    expect(g.local().error).toBe('')
  })

  it('after a draw that keeps the turn, plays only the drawn card', async () => {
    const contrarian = () => {
      let last: PlayerView | undefined
      return scriptedBot((view): BotAction => {
        const secondAsk = last !== undefined && view.hand.length === last.hand.length + 1
        last = secondAsk ? undefined : view
        return secondAsk ? { type: 'play', cardIndex: 0, sayUno: false } : { type: 'draw' }
      })
    }
    const g = setUp(contrarian)
    g.start()
    await play(g, 400)

    const rounds = roundChanges(g.states).map((state) => state.round!)
    const kept = _.range(1, rounds.length - 1).filter((i) => {
      const [before, drawn] = [rounds[i - 1]!, rounds[i]!]
      const seat = drawn.playerInTurn
      return (
        seat !== undefined &&
        seat !== HUMAN &&
        seat === before.playerInTurn &&
        drawn.hands[seat]!.length === before.hands[seat]!.length + 1
      )
    })
    expect(kept.length).toBeGreaterThan(0)
    kept.forEach((i) => {
      const [drawn, next] = [rounds[i]!, rounds[i + 1]!]
      const seat = drawn.playerInTurn!
      expect(next.discardPile[0]).toEqual(_.last(drawn.hands[seat]))
      expect(next.hands[seat]).toHaveLength(drawn.hands[seat]!.length - 1)
    })
  })

  it('lets the other bots catch a player left with one card before the next move', async () => {
    const g = setUp(() => inProcessBot({ forgetUnoChance: 1, catchUnoChance: 1 }))
    g.start()
    await play(g, 5000)

    const changes = roundChanges(g.states)
    const leftWithOne = _.range(1, changes.length - 1).flatMap((i) => {
      const [before, after] = [changes[i - 1]!.round!, changes[i]!.round!]
      const played = after.discardPile.length === before.discardPile.length + 1
      return played
        ? _.range(0, after.playerCount)
            .filter((p) => before.hands[p]!.length === 2 && after.hands[p]!.length === 1)
            .map((p) => ({ i, p }))
        : []
    })
    expect(leftWithOne.some(({ p }) => p !== HUMAN)).toBe(true)
    expect(leftWithOne.some(({ p }) => p === HUMAN)).toBe(true)
    leftWithOne.forEach(({ i, p }) => {
      const next = changes[i + 1]!
      expect(next.lastAccusation).toMatchObject({ accused: p, caught: true })
      expect(next.lastAccusation!.accuser).not.toBe(p)
      expect(next.lastAccusation!.accuser).not.toBe(HUMAN)
      expect(next.round!.hands[p]).toHaveLength(5)
    })
  })

  it('stops and terminates the bots when the game is ended', async () => {
    const g = setUp(alwaysDraw)
    g.start()
    await untilBotInTurn(g)
    g.store.dispatch(g.thunks.endLocalGame())
    expect(g.bots.every((bot) => bot.terminated)).toBe(true)

    const asked = _.sumBy((bot: FakeBot) => bot.views.length, g.bots)
    await vi.advanceTimersByTimeAsync(thinkMs * 5)
    expect(_.sumBy((bot: FakeBot) => bot.views.length, g.bots)).toBe(asked)
    expect(g.local().round).toBeUndefined()
    expect(g.local().botsThinking).toBe(false)
  })

  it('stops the old loop when a new game starts', async () => {
    const g = setUp(alwaysDraw)
    g.start()
    await untilBotInTurn(g)
    const oldBots = [...g.bots]
    const asked = _.sumBy((bot: FakeBot) => bot.views.length, oldBots)

    g.start()
    expect(oldBots.every((bot) => bot.terminated)).toBe(true)
    await untilBotInTurn(g)
    const moves = g.local().moves
    await vi.advanceTimersByTimeAsync(thinkMs)

    expect(_.sumBy((bot: FakeBot) => bot.views.length, oldBots)).toBe(asked)
    expect(g.local().moves).toBeGreaterThan(moves)
    expect(g.local().botsThinking).toBe(g.round().playerInTurn !== HUMAN)
  })
})

describe('human moves', () => {
  it('reports an illegal play and lets no bot move', async () => {
    const g = setUp(alwaysDraw)
    g.start()
    await untilBotInTurn(g)
    await vi.advanceTimersByTimeAsync(thinkMs * 10)
    const before = g.round()
    expect(before.playerInTurn).toBe(HUMAN)

    await g.store.dispatch(g.thunks.playLocal(99))
    expect(g.local().error).not.toBe('')
    expect(g.round()).toBe(before)
  })

  it('accuses a bot, and tells whether it was caught', async () => {
    const g = setUp(() => inProcessBot({ forgetUnoChance: 1, catchUnoChance: 0 }))
    g.start()
    expect(g.store.dispatch(g.thunks.accuseLocal(1))).toBe(false)

    const botOpenToCatch = () => ![undefined, HUMAN].includes(g.round().openToCatch)
    for (let step = 0; step < 5000 && !botOpenToCatch(); step++) {
      if (humansTurn(g)) void humanMove(g)
      await vi.advanceTimersByTimeAsync(thinkMs / 10)
    }
    const accused = g.round().openToCatch!
    expect(accused).not.toBe(HUMAN)
    expect(g.store.dispatch(g.thunks.accuseLocal(accused))).toBe(true)
    expect(g.round().hands[accused]).toHaveLength(5)
    expect(g.local().lastAccusation).toEqual({ accuser: HUMAN, accused, caught: true })
  })
})
