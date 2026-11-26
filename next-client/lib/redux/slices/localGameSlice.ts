// A game against bots, played in the browser. This is where the functional
// model from assignment 4 does the work: every reducer is a model transition
// (Round => Round) applied to the round in the state.
import { createSlice, isDraft, original, type PayloadAction } from '@reduxjs/toolkit'
import * as _ from 'lodash/fp'
import type { Color } from '@model/deck'
import * as Round from '@model/round'
import { randomIndex, randomSeed, shufflerFor } from '../random'

export const HUMAN = 0

// The model's Round without its shuffler. Functions don't belong in Redux
// state, so the reducers add a seeded shuffler back when they need one.
export type RoundState = Readonly<Omit<Round.Round, 'shuffler'>>

export type Accusation = Round.Accusation & Readonly<{ caught: boolean }>

export type LocalGameState = Readonly<{
  round: RoundState | undefined
  seed: number
  moves: number
  botsThinking: boolean
  lastAccusation: Accusation | undefined
  error: string
}>

export type GameSetup = Readonly<{ playerName: string; botCount: 1 | 2 | 3 }>

export type Move = Readonly<{
  player: number
  cardIndex: number
  color?: Color
  sayUno?: boolean
}>

const initialState: LocalGameState = {
  round: undefined,
  seed: 0,
  moves: 0,
  botsThinking: false,
  lastAccusation: undefined,
  error: '',
}

// ---------- Helpers ----------

// Reducers get an Immer draft. We never change it, so its original is the same
// value as plain, frozen data, which is what the model expects.
const plain = (state: object): LocalGameState =>
  (isDraft(state) ? original(state) : state) as LocalGameState

const toRound = ({ round, seed, moves }: LocalGameState): Round.Round => ({
  ...round!,
  shuffler: shufflerFor(seed, moves),
})

const toRoundState = (round: Round.Round): RoundState => _.omit('shuffler', round) as RoundState

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Runs a model transition. An illegal move leaves the round as it was and
// stores the model's error message instead.
const apply = (
  draft: LocalGameState,
  transition: (round: Round.Round) => Round.Round,
  extra: Partial<LocalGameState> = {},
): LocalGameState => {
  const state = plain(draft)
  if (state.round === undefined) return { ...state, error: 'No game in progress' }
  try {
    return {
      ...state,
      round: toRoundState(transition(toRound(state))),
      moves: state.moves + 1,
      lastAccusation: undefined,
      error: '',
      ...extra,
    }
  } catch (e) {
    return { ...state, error: message(e) }
  }
}

const requireTurn = (player: number) => (round: Round.Round): Round.Round => {
  if (round.playerInTurn !== player) throw new Error('It is not your turn')
  return round
}

// ---------- Slice ----------

export const localGameSlice = createSlice({
  name: 'localGame',
  initialState,
  reducers: {
    // The random parts (dealer and seed) are picked when the action is
    // created, so the reducer itself is pure.
    started: {
      prepare: ({ playerName, botCount }: GameSetup) => {
        const players = [playerName, ..._.range(1, botCount + 1).map((i) => `Bot ${i}`)]
        return { payload: { players, dealer: randomIndex(players.length), seed: randomSeed() } }
      },
      reducer: (
        _state,
        { payload: { players, dealer, seed } }: PayloadAction<{ players: string[]; dealer: number; seed: number }>,
      ): LocalGameState => ({
        ...initialState,
        round: toRoundState(Round.createRound(players, dealer, shufflerFor(seed, 0))),
        seed,
        moves: 1,
      }),
    },

    // Play a card. Saying UNO with the play counts as saying it first.
    played: (state, { payload: { player, cardIndex, color, sayUno = false } }: PayloadAction<Move>) =>
      apply(
        state,
        _.flow([
          requireTurn(player),
          sayUno ? Round.sayUno(player) : _.identity,
          Round.play(cardIndex, color),
        ]),
      ),

    // Draw a card. If it can be played, the turn stays with the player.
    drew: (state, { payload: player }: PayloadAction<number>) =>
      apply(state, _.flow([requireTurn(player), Round.draw])),

    saidUno: (state, { payload: player }: PayloadAction<number>) => apply(state, Round.sayUno(player)),

    // Someone says another player forgot UNO. If so, the accused draws 4.
    accused: (state, { payload: accusation }: PayloadAction<Round.Accusation>) => {
      const before = plain(state)
      if (before.round === undefined) return { ...before, error: 'No game in progress' }
      try {
        const caught = Round.checkUnoFailure(accusation, toRound(before))
        return apply(state, Round.catchUnoFailure(accusation), {
          lastAccusation: { ...accusation, caught },
        })
      } catch (e) {
        return { ...before, error: message(e) }
      }
    },

    botsThinkingChanged: (state, { payload }: PayloadAction<boolean>): LocalGameState => ({
      ...plain(state),
      botsThinking: payload,
    }),

    errorCleared: (state): LocalGameState => ({ ...plain(state), error: '' }),

    ended: (): LocalGameState => initialState,
  },
})

export const { started, played, drew, saidUno, accused, botsThinkingChanged, errorCleared, ended } =
  localGameSlice.actions
