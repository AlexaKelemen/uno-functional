import { describe, it, expect } from '@jest/globals'
import * as _ from 'lodash/fp'
import { Card, Color } from '../../src/model/deck'
import { canPlay, canPlayCard, createRound, play, draw, Round, topOfDiscard } from '../../src/model/round'

const red5: Card = { type: 'NUMBERED', color: 'RED', number: 5 }
const blue5: Card = { type: 'NUMBERED', color: 'BLUE', number: 5 }
const blue3: Card = { type: 'NUMBERED', color: 'BLUE', number: 3 }
const redSkip: Card = { type: 'SKIP', color: 'RED' }
const blueSkip: Card = { type: 'SKIP', color: 'BLUE' }
const blueDraw: Card = { type: 'DRAW', color: 'BLUE' }
const wild: Card = { type: 'WILD' }
const wildDraw: Card = { type: 'WILD DRAW' }

describe('canPlayCard', () => {
  it('allows a card in the current color', () => {
    expect(canPlayCard(red5, [red5], blue3, 'RED')).toBe(true)
    expect(canPlayCard(redSkip, [redSkip], blue3, 'RED')).toBe(true)
  })

  it('allows a numbered card with the same number as the top card', () => {
    expect(canPlayCard(blue5, [blue5], red5, 'RED')).toBe(true)
  })

  it('refuses a numbered card with another number and color', () => {
    expect(canPlayCard(blue3, [blue3], red5, 'RED')).toBe(false)
  })

  it('allows an action card of the same type as the top card', () => {
    expect(canPlayCard(blueSkip, [blueSkip], redSkip, 'RED')).toBe(true)
  })

  it('refuses an action card of another type and color', () => {
    expect(canPlayCard(blueDraw, [blueDraw], redSkip, 'RED')).toBe(false)
  })

  it('uses the current color, not the color of the top card, after a wild', () => {
    expect(canPlayCard(blue3, [blue3], wild, 'BLUE')).toBe(true)
    expect(canPlayCard(red5, [red5], wild, 'BLUE')).toBe(false)
  })

  it('always allows a wild card', () => {
    expect(canPlayCard(wild, [wild, red5], blue3, 'RED')).toBe(true)
  })

  it('allows a wild draw 4 only when the hand has no card in the current color', () => {
    expect(canPlayCard(wildDraw, [wildDraw, blue3], red5, 'RED')).toBe(true)
    expect(canPlayCard(wildDraw, [wildDraw, red5], blue3, 'RED')).toBe(false)
  })

  it('does not count a wild card in the hand as having the current color', () => {
    expect(canPlayCard(wildDraw, [wildDraw, wild], red5, 'RED')).toBe(true)
  })
})

describe('canPlay agrees with canPlayCard', () => {
  const seeded = (seed: number) => {
    let state = seed
    return (bound: number) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state % bound
    }
  }

  const shufflerFrom = (random: (bound: number) => number) => (cards: readonly Card[]): Card[] =>
    _.range(cards.length - 1, 0).reduce(
      (shuffled: Card[], i) => {
        const j = random(i + 1)
        return shuffled.map((card, index) => (index === i ? shuffled[j] : index === j ? shuffled[i] : card))
      },
      [...cards]
    )

  const colors: readonly Color[] = ['BLUE', 'GREEN', 'RED', 'YELLOW']

  const playFor = (moves: number, round: Round, random: (bound: number) => number): readonly Round[] =>
    _.range(0, moves).reduce(
      (rounds: Round[], _move) => {
        const current = rounds[rounds.length - 1]
        if (current.playerInTurn === undefined) return rounds
        const hand = current.hands[current.playerInTurn]
        const index = hand.findIndex((_card, i) => canPlay(i, current))
        const card = hand[index]
        const next =
          index === -1
            ? draw(current)
            : play(index, card.type === 'WILD' || card.type === 'WILD DRAW' ? colors[random(4)] : undefined, current)
        return [...rounds, next]
      },
      [round]
    )

  it.each(_.range(0, 20))('in seeded game %i', seed => {
    const random = seeded(seed + 1)
    const start = createRound(['a', 'b', 'c'], seed % 3, shufflerFrom(random))
    playFor(60, start, random)
      .filter(round => round.playerInTurn !== undefined)
      .forEach(round => {
        const hand = round.hands[round.playerInTurn!]
        hand.forEach((card, i) =>
          expect(canPlayCard(card, hand, topOfDiscard(round), round.currentColor)).toBe(canPlay(i, round))
        )
      })
  })
})
