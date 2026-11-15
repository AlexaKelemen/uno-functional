import type { Round } from '@domain/model/round.js'
import { standardShuffler } from '@domain/utils/random_utils.js'
import type { ActiveGame } from './serverModel.js'

const seededRound: Round = {
  players: ['Alice', 'Bob'],
  playerCount: 2,
  dealer: 1,
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
  direction: 1,
  playerInTurn: 0,
  saidUno: [],
  openToCatch: undefined,
  shuffler: standardShuffler,
}

export function seededGame(id = '0'): ActiveGame {
  return { id, pending: false, round: seededRound }
}
