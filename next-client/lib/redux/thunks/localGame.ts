import * as _ from 'lodash/fp'
import { colors, isWild, type Color } from '@model/deck'
import { createBot as createWorkerBot, type Bot } from '../../bots/botClient'
import { bestColor, type Random } from '../../bots/botStrategy'
import type { AppThunk, RootState } from '../store'
import { selectLocalViewFor, selectLocalWinner } from '../selectors'
import {
  accused,
  botsThinkingChanged,
  drew,
  ended,
  HUMAN,
  played,
  started,
  type GameSetup,
} from '../slices/localGameSlice'

export type BotGameOptions = Readonly<{
  createBot: (seat: number) => Bot
  thinkMs: number
  random: Random
}>

type Dispatch = Parameters<AppThunk>[0]
type GetState = () => RootState

const defaultOptions: BotGameOptions = {
  createBot: () => createWorkerBot(),
  thinkMs: 2000,
  random: Math.random,
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isKnownColor = (color: Color | undefined) => color === undefined || colors.includes(color)

export function createLocalGameThunks(options: Partial<BotGameOptions> = {}) {
  const { createBot, thinkMs, random } = { ...defaultOptions, ...options }

  let table: Readonly<{ seed: number; bots: ReadonlyMap<number, Bot> }> | undefined
  let running: Readonly<{ seed: number; done: Promise<void> }> | undefined

  const dismissBots = () => {
    table?.bots.forEach((bot) => bot.terminate())
    table = undefined
  }

  const botsOf = (seed: number): ReadonlyMap<number, Bot> =>
    table?.seed === seed ? table.bots : new Map()

  const roundOf = (getState: GetState, seed: number) => {
    const { round, seed: current } = getState().localGame
    return current === seed ? round : undefined
  }

  const viewFor = (getState: GetState, seat: number) => selectLocalViewFor(getState(), seat)!

  async function offerUnoCatch(dispatch: Dispatch, getState: GetState, seed: number, player: number) {
    for (const [seat, bot] of botsOf(seed)) {
      if (seat === player) continue
      if (roundOf(getState, seed)?.hands[player]?.length !== 1) return
      const action = await bot.considerUnoAccusation(viewFor(getState, seat), player)
      if (action.type === 'accuse' && roundOf(getState, seed) !== undefined) {
        dispatch(accused({ accuser: seat, accused: player }))
        return
      }
    }
  }

  async function playDrawnCard(dispatch: Dispatch, getState: GetState, seed: number, seat: number, bot: Bot) {
    const hand = roundOf(getState, seed)!.hands[seat]!
    const drawnIndex = hand.length - 1
    const second = await bot.chooseAction(viewFor(getState, seat))
    if (roundOf(getState, seed)?.playerInTurn !== seat) return
    const fromBot = second.type === 'play' && second.cardIndex === drawnIndex ? second : undefined
    const botColor = fromBot?.color !== undefined && isKnownColor(fromBot.color) ? fromBot.color : undefined
    const color = isWild(hand[drawnIndex]!) ? (botColor ?? bestColor(hand, random)) : undefined
    dispatch(played({ player: seat, cardIndex: drawnIndex, color, sayUno: fromBot?.sayUno ?? hand.length === 2 }))
    await offerUnoCatch(dispatch, getState, seed, seat)
  }

  async function playBotTurn(dispatch: Dispatch, getState: GetState, seed: number, seat: number, bot: Bot) {
    const action = await bot.chooseAction(viewFor(getState, seat))
    if (roundOf(getState, seed)?.playerInTurn !== seat) return
    if (action.type === 'play' && isKnownColor(action.color)) {
      const { cardIndex, color, sayUno } = action
      dispatch(played({ player: seat, cardIndex, color, sayUno }))
      if (getState().localGame.error === '') return offerUnoCatch(dispatch, getState, seed, seat)
    }
    dispatch(drew(seat))
    if (roundOf(getState, seed)?.playerInTurn === seat) await playDrawnCard(dispatch, getState, seed, seat, bot)
  }

  async function playBots(dispatch: Dispatch, getState: GetState, seed: number) {
    const botInTurn = (): number | undefined => {
      const player = roundOf(getState, seed)?.playerInTurn
      return player !== undefined && botsOf(seed).has(player) ? player : undefined
    }
    if (botInTurn() !== undefined) {
      dispatch(botsThinkingChanged(true))
      try {
        for (let seat = botInTurn(); seat !== undefined; seat = botInTurn()) {
          await delay(thinkMs)
          if (botInTurn() === seat) await playBotTurn(dispatch, getState, seed, seat, botsOf(seed).get(seat)!)
        }
      } finally {
        if (roundOf(getState, seed) !== undefined) dispatch(botsThinkingChanged(false))
      }
    }
    if (roundOf(getState, seed) !== undefined && selectLocalWinner(getState()) !== undefined) dismissBots()
  }

  const runBots = (): AppThunk<Promise<void>> => (dispatch, getState) => {
    const seed = getState().localGame.seed
    if (running?.seed !== seed) {
      const done: Promise<void> = playBots(dispatch, getState, seed).finally(() => {
        if (running?.done === done) running = undefined
      })
      running = { seed, done }
    }
    return running.done
  }

  const startLocalGame =
    (setup: GameSetup): AppThunk<Promise<void>> =>
    (dispatch) => {
      dismissBots()
      const { payload } = dispatch(started(setup))
      const seats = _.range(1, payload.players.length)
      table = { seed: payload.seed, bots: new Map(seats.map((seat) => [seat, createBot(seat)])) }
      return dispatch(runBots())
    }

  const playLocal =
    (cardIndex: number, color?: Color, sayUno = false): AppThunk<Promise<void>> =>
    async (dispatch, getState) => {
      dispatch(played({ player: HUMAN, cardIndex, color, sayUno }))
      if (getState().localGame.error !== '') return
      await offerUnoCatch(dispatch, getState, getState().localGame.seed, HUMAN)
      await dispatch(runBots())
    }

  const drawLocal = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
    dispatch(drew(HUMAN))
    if (getState().localGame.error !== '') return
    await dispatch(runBots())
  }

  const accuseLocal =
    (accusedPlayer: number): AppThunk<boolean> =>
    (dispatch, getState) => {
      dispatch(accused({ accuser: HUMAN, accused: accusedPlayer }))
      return getState().localGame.lastAccusation?.caught ?? false
    }

  const endLocalGame = (): AppThunk => (dispatch) => {
    dismissBots()
    dispatch(ended())
  }

  return { startLocalGame, playLocal, drawLocal, accuseLocal, endLocalGame, runBots }
}

export const { startLocalGame, playLocal, drawLocal, accuseLocal, endLocalGame, runBots } =
  createLocalGameThunks()
