import { UnoRound, type RoundMemento } from '@domain/model/round.js'
import type { ActiveGame } from './serverModel.js'

const seededGameMemento: RoundMemento = {
  players: ['Alice', 'Bob'],
  hands: [
    [{ type: 'NUMBERED', color: 'RED', number: 5 }, { type: 'WILD' }],
    [
      { type: 'NUMBERED', color: 'BLUE', number: 7 },
      { type: 'SKIP', color: 'GREEN' },
      { type: 'DRAW', color: 'YELLOW' },
    ],
  ],
  drawPile: [
    { type: 'NUMBERED', color: 'GREEN', number: 2 },
    { type: 'NUMBERED', color: 'YELLOW', number: 9 },
    { type: 'NUMBERED', color: 'BLUE', number: 1 },
    { type: 'REVERSE', color: 'RED' },
    { type: 'NUMBERED', color: 'GREEN', number: 6 },
    { type: 'NUMBERED', color: 'YELLOW', number: 4 },
  ],
  discardPile: [{ type: 'NUMBERED', color: 'RED', number: 3 }],
  currentColor: 'RED',
  currentDirection: 'clockwise',
  dealer: 1,
  playerInTurn: 0,
}

export function seededGame(id = '0'): ActiveGame {
  return { id, pending: false, round: UnoRound.fromMemento(seededGameMemento) }
}
