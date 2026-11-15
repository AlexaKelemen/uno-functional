// Seeded randomness, so the local game's reducers stay pure.
//
// The model's Round keeps a shuffler, because `draw` may have to reshuffle the
// discard pile. Math.random would make a reducer give a different result each
// time it runs. Instead the action creator picks a seed (the impure part), and
// the reducer builds a shuffler from that seed and the move number. The same
// state and action then always give the same next state.
import * as _ from 'lodash/fp'
import type { Card } from '@model/deck'
import type { Shuffler } from '@utils/random_utils'

export const randomSeed = (): number => Math.floor(Math.random() * 2 ** 32)

export const randomIndex = (bound: number): number => Math.floor(Math.random() * bound)

// Linear congruential generator: the same seed gives the same numbers
const seededRandom = (seed: number) => {
  let state = seed >>> 0
  return (bound: number): number => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return Math.floor((state / 4294967296) * bound)
  }
}

// Fisher-Yates with a seeded generator. Works on a copy. Shuffling twice with
// the same shuffler gives two different orders (createRound relies on that when
// it reshuffles a wild card off the top), but a new shuffler from the same seed
// starts over, so the result only depends on the seed.
export const seededShuffler = (seed: number): Shuffler<Card> => {
  const random = seededRandom(seed)
  return (cards) =>
    _.range(cards.length - 1, 0).reduce(
      (shuffled, i) => {
        const j = random(i + 1)
        return shuffled.map((card, index) => (index === i ? shuffled[j] : index === j ? shuffled[i] : card))
      },
      [...cards],
    )
}

// A different, but reproducible, shuffler for every move of a game
export const shufflerFor = (seed: number, move: number): Shuffler<Card> =>
  seededShuffler((seed + Math.imul(move, 2654435761)) >>> 0)
