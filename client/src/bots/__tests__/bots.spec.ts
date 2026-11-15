import { describe, expect, it } from 'vitest'
import type { Card, Color as CardColor } from '@model/deck'
import type { BotRequest, BotResponse, PlayerView } from '../botMessages'
import { chooseAction, considerUnoAccusation, legalPlays } from '../botStrategy'
import { createBot, type MessagePort } from '../botClient'

const red5: Card = { type: 'NUMBERED', color: 'RED', number: 5 }
const blue5: Card = { type: 'NUMBERED', color: 'BLUE', number: 5 }
const blue3: Card = { type: 'NUMBERED', color: 'BLUE', number: 3 }
const redSkip: Card = { type: 'SKIP', color: 'RED' }
const wild: Card = { type: 'WILD' }
const wild4: Card = { type: 'WILD DRAW' }

function view(hand: Card[], topCard: Card = red5, currentColor: CardColor = 'RED'): PlayerView {
  return {
    playerIndex: 1,
    playerNames: ['A', 'B'],
    handSizes: [7, hand.length],
    playerInTurn: 1,
    direction: 'clockwise',
    drawPileSize: 50,
    hand,
    topCard,
    currentColor,
  }
}

const never = () => 0.99 // random() that never forgets / never accuses
const always = () => 0

describe('bot strategy', () => {
  it('only considers legal cards (no Wild Draw 4 while holding the current colour)', () => {
    expect(legalPlays(view([blue5, blue3, wild4, redSkip]))).toEqual([0, 3])
    expect(legalPlays(view([blue3, wild4]))).toEqual([1])
  })

  it('draws when nothing can be played', () => {
    expect(chooseAction(view([blue3]))).toEqual({ type: 'draw' })
  })

  it('prefers action cards over numbers', () => {
    expect(chooseAction(view([blue5, redSkip]), undefined, never)).toMatchObject({ cardIndex: 1 })
  })

  it('names the colour it holds most of when playing a wild', () => {
    expect(chooseAction(view([blue3, wild]), undefined, never)).toEqual({
      type: 'play',
      cardIndex: 1,
      color: 'BLUE',
      sayUno: true,
    })
  })

  it('sometimes forgets to say Uno', () => {
    const p = { forgetUnoChance: 0.25, catchUnoChance: 0.5 }
    expect(chooseAction(view([red5, blue3]), p, never)).toMatchObject({ sayUno: true })
    expect(chooseAction(view([red5, blue3]), p, always)).toMatchObject({ sayUno: false })
  })

  it('sometimes accuses a player with one card', () => {
    expect(considerUnoAccusation(2, undefined, always)).toEqual({ type: 'accuse', accused: 2 })
    expect(considerUnoAccusation(2, undefined, never)).toEqual({ type: 'pass' })
  })
})

describe('bot client', () => {
  it('matches worker responses to requests by requestId, even out of order', async () => {
    const sent: BotRequest[] = []
    const port: MessagePort = { postMessage: (m) => sent.push(m), onmessage: null, terminate() {} }
    const bot = createBot(port)

    const first = bot.chooseAction(view([red5]))
    const second = bot.considerUnoAccusation(view([red5]), 0)
    const reply = (r: BotResponse) => port.onmessage!({ data: r } as MessageEvent<BotResponse>)
    reply({ requestId: sent[1]!.requestId, action: { type: 'pass' } })
    reply({ requestId: sent[0]!.requestId, action: { type: 'draw' } })

    expect(await first).toEqual({ type: 'draw' })
    expect(await second).toEqual({ type: 'pass' })
  })
})
