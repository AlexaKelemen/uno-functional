'use client'
import { useEffect, useState } from 'react'
import type { Color } from '@model/deck'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { HUMAN } from '@/lib/redux/slices/localGameSlice'
import {
  selectBotsThinking,
  selectLocalError,
  selectLocalView,
  selectLocalWinner,
  selectOnlineError,
  selectOnlineView,
  selectOnlineWinner,
  selectPlayerName,
  onlineView as toOnlineView,
} from '@/lib/redux/selectors'
import type { OnlineGame } from '@/lib/api/gameServer'
import { accuseLocal, drawLocal, endLocalGame as endLocal, playLocal } from '@/lib/redux/thunks/localGame'
import { accuseOnline, drawOnline, loadGame, playOnline } from '@/lib/redux/thunks/onlineGame'

// What the Next.js server rendered the page with: the game as it was when
// the page was requested, seen by the player named in the cookie.
export type InitialGame = Readonly<{ game: OnlineGame; renderedFor: string }>

// gameId undefined: the local game against bots. Otherwise an online game.
export function useGameSource(gameId?: string, initial?: InitialGame) {
  const dispatch = useAppDispatch()
  const isOnline = gameId !== undefined
  const me = useAppSelector(selectPlayerName)

  // The server-rendered game is shown until the store has the live one. The
  // first client render must use it too (same HTML as the server, no
  // hydration error). It is dropped if this tab turns out to be someone else.
  const [useInitial, setUseInitial] = useState(initial !== undefined)
  useEffect(() => {
    if (me !== undefined && me !== initial?.renderedFor) setUseInitial(false)
  }, [me, initial?.renderedFor])

  // Local
  const localView = useAppSelector(selectLocalView)
  const localWinner = useAppSelector(selectLocalWinner)
  const localError = useAppSelector(selectLocalError)
  const botsThinking = useAppSelector(selectBotsThinking)

  // Online
  const liveView = useAppSelector((state) => selectOnlineView(state, gameId ?? ''))
  const initialView = useInitial && initial ? toOnlineView(initial.game, initial.renderedFor) : undefined
  const onlineView = liveView ?? initialView
  const liveWinner = useAppSelector((state) => selectOnlineWinner(state, gameId ?? ''))
  const onlineWinner = liveView ? liveWinner : useInitial ? (initial?.game.winner ?? undefined) : undefined
  const onlineError = useAppSelector(selectOnlineError)

  const view = isOnline ? onlineView : localView
  const winner = isOnline ? onlineWinner : localWinner
  const error = isOnline ? onlineError : localError

  const mySeat = isOnline ? (view?.playerIndex ?? -1) : HUMAN
  const isMyTurn = view !== undefined && view.playerInTurn === mySeat

  const waitingText =
    !view || isMyTurn || winner !== undefined ? ''
    : !isOnline ? (botsThinking ? 'Bots are playing…' : '')
    : view.playerInTurn === undefined ? ''
    : `Waiting for ${view.playerNames[view.playerInTurn]}…`

  // Once logged in (the session is restored after hydration), fetch the live game
  useEffect(() => {
    if (gameId !== undefined && me !== undefined) void dispatch(loadGame(gameId))
  }, [gameId, me, dispatch])

  const play = async (cardIndex: number, color: Color | undefined, sayUno: boolean) => {
    if (gameId === undefined) await dispatch(playLocal(cardIndex, color, sayUno))
    else await dispatch(playOnline(gameId, cardIndex, color, sayUno))
  }

  const draw = async () => {
    if (gameId === undefined) await dispatch(drawLocal())
    else await dispatch(drawOnline(gameId))
  }

  const accuse = async (seat: number): Promise<boolean> =>
    gameId === undefined ? dispatch(accuseLocal(seat)) : dispatch(accuseOnline(gameId, seat))

  const endLocalGame = () => {
    if (!isOnline) dispatch(endLocal())
  }

  return { view, mySeat, isMyTurn, winner, waitingText, error, play, draw, accuse, endLocalGame }
}