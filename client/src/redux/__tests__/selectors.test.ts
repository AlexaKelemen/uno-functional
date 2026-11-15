import { describe, expect, it } from 'vitest'
import type { Card, Color } from '@model/deck'
import { onlineView, selectCanPlayCard, type PlayerView } from '../selectors'
import { onlineGame } from './fakeGameServer'

const red5: Card = { type: 'NUMBERED', color: 'RED', number: 5 }
const blue3: Card = { type: 'NUMBERED', color: 'BLUE', number: 3 }
const wildDraw: Card = { type: 'WILD DRAW' }

function view(hand: Card[], overrides: Partial<PlayerView> = {}, currentColor: Color = 'RED'): PlayerView {
  return {
    playerIndex: 0,
    playerNames: ['Ann', 'Ben'],
    handSizes: [hand.length, 7],
    playerInTurn: 0,
    direction: 'clockwise',
    drawPileSize: 50,
    hand,
    topCard: { type: 'NUMBERED', color: 'RED', number: 3 },
    currentColor,
    ...overrides,
  }
}

describe('selectCanPlayCard', () => {
  it('follows the model rule for the player in turn', () => {
    const mine = view([red5, blue3, wildDraw])
    expect([0, 1, 2].map((i) => selectCanPlayCard(mine, i))).toEqual([true, true, false])
  })

  it('allows a wild draw 4 only without a card in the current color', () => {
    expect(selectCanPlayCard(view([blue3, wildDraw], { topCard: blue3 }, 'GREEN'), 1)).toBe(true)
  })

  it('says no when it is not the viewer’s turn', () => {
    expect(selectCanPlayCard(view([red5], { playerInTurn: 1 }), 0)).toBe(false)
  })

  it('says no once the round is over, and for a card that is not in the hand', () => {
    expect(selectCanPlayCard(view([red5], { playerInTurn: undefined }), 0)).toBe(false)
    expect(selectCanPlayCard(view([red5]), 1)).toBe(false)
    expect(selectCanPlayCard(undefined, 0)).toBe(false)
  })

  it('works on the view of an online game', () => {
    const online = onlineView(onlineGame(), 'Ann')
    expect([0, 1].map((i) => selectCanPlayCard(online, i))).toEqual([true, true])
    expect(selectCanPlayCard(onlineView(onlineGame(), 'Ben'), 0)).toBe(false)
  })
})
