import { describe, it, expect } from '@jest/globals'
import * as _ from 'lodash'
import { Card, Color } from '../../src/model/deck'
import * as Round from '../../src/model/round'
import * as Uno from '../../src/model/uno'
import { Shuffler } from '../../src/utils/random_utils'
import { shuffleBuilder } from '../utils/shuffling'

// Frozen objects make any attempted mutation throw (test modules run in strict mode)
const deepFreeze = <T>(value: T): T => {
  if (_.isObject(value) && !_.isFunction(value) && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

// Small seeded generator, so a failing game can be reproduced
const seededRandom = (seed: number) => {
  let state = seed
  return (bound: number) => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return Math.floor((state / 4294967296) * bound)
  }
}

const seededShuffler = (random: (bound: number) => number): Shuffler<Card> => cards =>
  _.reduceRight(
    _.range(1, cards.length),
    (shuffled, i) => {
      const j = random(i + 1)
      return _.map(shuffled, (card, index) => (index === i ? shuffled[j] : index === j ? shuffled[i] : card))
    },
    [...cards]
  )

const cardsInRound = (round: Round.Round) =>
  _.flatten(round.hands).length + round.drawPile.length + round.discardPile.length

describe('purity', () => {
  const shuffler = shuffleBuilder()
    .discard().is({ type: 'NUMBERED', color: 'BLUE', number: 6 })
    .hand(0).is({ type: 'NUMBERED', color: 'BLUE', number: 3 })
    .build()
  const round = deepFreeze(Round.createRound(['a', 'b', 'c', 'd'], 3, shuffler))

  it('leaves its input untouched', () => {
    const snapshot = _.cloneDeep(round)
    Round.play(0, undefined, round)
    Round.draw(round)
    Round.sayUno(1, round)
    Round.catchUnoFailure({ accuser: 1, accused: 0 }, round)
    expect(round).toEqual(snapshot)
  })
  it('gives the same output for the same input', () => {
    expect(Round.play(0, undefined, round)).toEqual(Round.play(0, undefined, round))
    expect(Round.draw(round)).toEqual(Round.draw(round))
  })
  it('supports partial application', () => {
    expect(Round.play(0, undefined)(round)).toEqual(Round.play(0, undefined, round))
    expect(Round.sayUno(1)(round)).toEqual(Round.sayUno(1, round))
  })
})

describe('full games with random moves', () => {
  const pickAction = (round: Round.Round, random: (bound: number) => number) => {
    const player = round.playerInTurn!
    const hand = round.hands[player]
    const playable = _.range(hand.length).filter(i => Round.canPlay(i, round))
    if (playable.length === 0) return Round.draw
    const cardIndex = playable[random(playable.length)]
    const type = hand[cardIndex].type
    const wild = type === 'WILD' || type === 'WILD DRAW'
    const color: Color | undefined = wild ? (['BLUE', 'GREEN', 'RED', 'YELLOW'] as const)[random(4)] : undefined
    const say = hand.length === 2 && random(2) === 0
    return _.flow([
      (r: Round.Round) => (say ? Round.sayUno(player, r) : r),
      (r: Round.Round) => Round.play(cardIndex, color, r),
    ])
  }

  const accusing = (round: Round.Round): Round.Round =>
    round.openToCatch === undefined
      ? round
      : Round.catchUnoFailure({ accuser: (round.openToCatch + 1) % round.playerCount, accused: round.openToCatch }, round)

  const playOut = (game: Uno.Game, random: (bound: number) => number, steps = 0): Uno.Game => {
    if (game.currentRound === undefined) return game
    if (steps > 100000) throw new Error('Game did not finish')
    deepFreeze(game.currentRound)
    expect(cardsInRound(game.currentRound)).toBe(108)
    const action = pickAction(game.currentRound, random)
    const catchSometimes = random(2) === 0 ? accusing : _.identity
    const next = Uno.play(_.flow([action, (r: Round.Round) => (Round.hasEnded(r) ? r : catchSometimes(r))]), game)
    return playOut(next, random, steps + 1)
  }

  it.each(_.range(1, 41))('keeps all 108 cards and finds a winner (seed %i)', seed => {
    const random = seededRandom(seed)
    const players = _.range(2 + (seed % 9)).map(String)
    const start = Uno.createGame({
      players,
      targetScore: 300,
      randomizer: random,
      shuffler: seededShuffler(random),
    })
    const end = playOut(start, random)
    expect(end.winner).toBeDefined()
    expect(end.scores[end.winner!]).toBeGreaterThanOrEqual(300)
    expect(end.currentRound).toBeUndefined()
  })
})
