import * as _ from 'lodash/fp'
import { Card } from './deck'
import * as Round from './round'
import { Randomizer, Shuffler, standardRandomizer, standardShuffler } from '../utils/random_utils'

export type Props = Readonly<{
  players: readonly string[]
  targetScore: number
  randomizer: Randomizer
  shuffler: Shuffler<Card>
  cardsPerPlayer: number
}>

export type Game = Readonly<{
  players: readonly string[]
  playerCount: number
  targetScore: number
  scores: readonly number[]
  winner: number | undefined
  currentRound: Round.Round | undefined
  shuffler: Shuffler<Card>
  cardsPerPlayer: number
}>

export function createGame({
  players = ['A', 'B'],
  targetScore = 500,
  randomizer = standardRandomizer,
  shuffler = standardShuffler,
  cardsPerPlayer = 7,
}: Partial<Props>): Game {
  if (targetScore <= 0) throw new Error('The target score must be more than 0')
  return {
    players,
    playerCount: players.length,
    targetScore,
    scores: players.map(() => 0),
    winner: undefined,
    currentRound: Round.createRound(players, randomizer(players.length), shuffler, cardsPerPlayer),
    shuffler,
    cardsPerPlayer,
  }
}

// The deal passes to the left after each round
const nextRound = (finished: Round.Round, game: Game): Round.Round =>
  Round.createRound(
    game.players,
    (finished.dealer + 1) % game.playerCount,
    game.shuffler,
    game.cardsPerPlayer
  )

const finishRound = (round: Round.Round, game: Game): Game => {
  const roundWinner = Round.winner(round)!
  const scores: readonly number[] = _.update([roundWinner], _.add(Round.score(round)!), game.scores)
  const gameWon = scores[roundWinner] >= game.targetScore
  return {
    ...game,
    scores,
    winner: gameWon ? roundWinner : undefined,
    currentRound: gameWon ? undefined : nextRound(round, game),
  }
}

// Applies a round action (play, draw, sayUno, ...) to the current round
export const play = _.curry((action: (round: Round.Round) => Round.Round, game: Game): Game => {
  if (game.currentRound === undefined) throw new Error('The game has ended')
  const round = action(game.currentRound)
  return Round.hasEnded(round) ? finishRound(round, game) : { ...game, currentRound: round }
})
