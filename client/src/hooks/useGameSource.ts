import { useEffect } from 'react'
import { useParams } from 'react-router'
import type { Color } from '@model/deck'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { HUMAN } from '@/redux/slices/localGameSlice'
import {
  selectBotsThinking,
  selectLocalError,
  selectLocalView,
  selectLocalWinner,
  selectOnlineError,
  selectOnlineView,
  selectOnlineWinner,
} from '@/redux/selectors'
import { accuseLocal, drawLocal, endLocalGame as endLocal, playLocal } from '@/redux/thunks/localGame'
import { accuseOnline, drawOnline, loadGame, playOnline } from '@/redux/thunks/onlineGame'

export function useGameSource() {
  const dispatch = useAppDispatch()

  const { gameId } = useParams()
  const isOnline = gameId !== undefined

  // Local
  const localView = useAppSelector(selectLocalView)
  const localWinner = useAppSelector(selectLocalWinner)
  const localError = useAppSelector(selectLocalError)
  const botsThinking = useAppSelector(selectBotsThinking)

  // Online
  const onlineView = useAppSelector((state) => selectOnlineView(state, gameId ?? ''))
  const onlineWinner = useAppSelector((state) => selectOnlineWinner(state, gameId ?? ''))
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

  useEffect(() => {
    if (gameId !== undefined) void dispatch(loadGame(gameId))
  }, [gameId, dispatch])

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