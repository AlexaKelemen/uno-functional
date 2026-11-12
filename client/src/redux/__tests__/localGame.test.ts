import { describe, expect, it } from 'vitest'
import * as _ from 'lodash/fp'
import * as Round from '@model/round'
import { makeStore } from '../store'
import {
  accused,
  drew,
  ended,
  localGameSlice,
  played,
  saidUno,
  started,
  type LocalGameState,
} from '../slices/localGameSlice'
import { selectLocalView, selectLocalWinner } from '../selectors'

const reducer = localGameSlice.reducer

// A started action with fixed randomness, so the tests are repeatable
const startWith = (seed: number, dealer = 0) => ({
  type: started.type,
  payload: { players: ['Ann', 'Bot 1', 'Bot 2'], dealer, seed },
})

const startedState = (seed = 42) => reducer(undefined, startWith(seed))

const asRound = (state: LocalGameState) => state.round as Round.Round

const playableIndex = (state: LocalGameState) => {
  const round = asRound(state)
  return round.hands[round.playerInTurn!].findIndex((_card, i) => Round.canPlay(i, round))
}

const cardsInRound = (state: LocalGameState) =>
  _.flatten(state.round!.hands).length + state.round!.drawPile.length + state.round!.discardPile.length

describe('localGame slice', () => {
  it('starts a round with the human and the bots', () => {
    const action = started({ playerName: 'Ann', botCount: 2 })
    expect(action.payload.players).toEqual(['Ann', 'Bot 1', 'Bot 2'])
    const state = reducer(undefined, action)
    expect(state.round!.hands).toHaveLength(3)
    expect(state.round!.hands[0].length).toBeGreaterThanOrEqual(7)
    expect(cardsInRound(state)).toBe(108)
  })

  it('keeps no functions in the state', () => {
    expect(startedState().round).not.toHaveProperty('shuffler')
  })

  it('is pure: same state and action give the same result, and nothing is changed', () => {
    const state = startedState()
    const snapshot = JSON.stringify(state)
    const player = state.round!.playerInTurn!
    const a = reducer(state, drew(player))
    const b = reducer(state, drew(player))
    expect(a).toEqual(b)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('starts the same way from the same seed', () => {
    expect(startedState(7)).toEqual(startedState(7))
    expect(startedState(7).round!.hands).not.toEqual(startedState(8).round!.hands)
  })

  it('plays a legal card using the model', () => {
    // Find a seed where the player in turn can play straight away
    const state = _.range(1, 50).map(startedState).find((s) => playableIndex(s) !== -1)!
    const player = state.round!.playerInTurn!
    const index = playableIndex(state)
    const card = state.round!.hands[player][index]
    const color = card.type === 'WILD' || card.type === 'WILD DRAW' ? 'RED' : undefined

    const next = reducer(state, played({ player, cardIndex: index, color }))

    expect(next.error).toBe('')
    expect(next.round!.hands[player]).toHaveLength(6)
    expect(next.round!.discardPile[0]).toEqual(card)
    expect(next.moves).toBe(state.moves + 1)
  })

  it('refuses a move out of turn and keeps the round', () => {
    const state = startedState()
    const notInTurn = (state.round!.playerInTurn! + 1) % 3
    const next = reducer(state, played({ player: notInTurn, cardIndex: 0 }))
    expect(next.error).toBe('It is not your turn')
    expect(next.round).toBe(state.round)
  })

  it('passes on the model error for an illegal card', () => {
    const state = startedState()
    const round = asRound(state)
    const player = round.playerInTurn!
    const illegal = round.hands[player].findIndex((_card, i) => !Round.canPlay(i, round))
    if (illegal === -1) return // every card happens to be playable
    const next = reducer(state, played({ player, cardIndex: illegal }))
    expect(next.error).toBe('Illegal play')
    expect(next.round).toBe(state.round)
  })

  it('draws a card', () => {
    const state = startedState()
    const player = state.round!.playerInTurn!
    const next = reducer(state, drew(player))
    expect(next.round!.hands[player]).toHaveLength(8)
  })

  it('records a wrong UNO accusation as not caught', () => {
    const state = startedState()
    const next = reducer(state, accused({ accuser: 0, accused: 1 }))
    expect(next.lastAccusation).toEqual({ accuser: 0, accused: 1, caught: false })
    expect(next.round!.hands).toEqual(state.round!.hands)
  })

  it('lets a player say UNO', () => {
    const next = reducer(startedState(), saidUno(2))
    expect(next.round!.saidUno).toEqual([2])
  })

  it('ends the game', () => {
    expect(reducer(startedState(), ended()).round).toBeUndefined()
  })
})

describe('local game through the store', () => {
  it('plays a whole round to a winner', () => {
    const store = makeStore()
    store.dispatch(startWith(2024))
    for (let turn = 0; turn < 2000 && selectLocalWinner(store.getState()) === undefined; turn++) {
      const state = store.getState().localGame
      const round = asRound(state)
      const player = round.playerInTurn!
      const index = playableIndex(state)
      if (index === -1) {
        store.dispatch(drew(player))
      } else {
        const card = round.hands[player][index]
        const wild = card.type === 'WILD' || card.type === 'WILD DRAW'
        store.dispatch(
          played({ player, cardIndex: index, color: wild ? 'BLUE' : undefined, sayUno: round.hands[player].length === 2 }),
        )
      }
      expect(store.getState().localGame.error).toBe('')
      expect(cardsInRound(store.getState().localGame)).toBe(108)
    }
    expect(selectLocalWinner(store.getState())).toBeDefined()
  })

  it('shows the round from the human seat', () => {
    const store = makeStore()
    store.dispatch(startWith(5))
    const view = selectLocalView(store.getState())!
    expect(view.playerIndex).toBe(0)
    expect(view.hand).toEqual(store.getState().localGame.round!.hands[0])
    // A draw-2 starter can give someone more than 7
    expect(view.handSizes).toEqual(store.getState().localGame.round!.hands.map((h) => h.length))
    expect(view.topCard).toEqual(store.getState().localGame.round!.discardPile[0])
    // Memoized: same state gives the same object
    expect(selectLocalView(store.getState())).toBe(view)
  })
})
