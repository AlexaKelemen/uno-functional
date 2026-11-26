// Moves in an online game. The server checks them and answers with the new
// game state, which goes into the onlineGames slice.
import type { Color } from '@model/deck'
import type { OnlineGame } from '../../api/gameServer'
import type { Connection } from '../../api/connection'
import type { AppThunk } from '../store'
import { errorCleared, failed, gameReceived } from '../slices/onlineGamesSlice'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const send =
  (move: (server: ReturnType<Connection['require']>) => Promise<OnlineGame>): AppThunk<Promise<OnlineGame | undefined>> =>
  async (dispatch, _getState, connection) => {
    dispatch(errorCleared())
    try {
      const game = await move(connection.require())
      dispatch(gameReceived(game))
      return game
    } catch (e) {
      dispatch(failed(message(e)))
      return undefined
    }
  }

export const loadGame =
  (id: string): AppThunk<Promise<void>> =>
  async (dispatch, _getState, connection) => {
    dispatch(errorCleared())
    try {
      const game = await connection.require().game(id)
      if (game) dispatch(gameReceived(game))
      else dispatch(failed('This game does not exist'))
    } catch (e) {
      dispatch(failed(message(e)))
    }
  }

export const playOnline = (id: string, cardIndex: number, color: Color | undefined, sayUno: boolean) =>
  send((server) => server.playCard(id, { cardIndex, color, sayUno }))

export const drawOnline = (id: string) => send((server) => server.drawCard(id))

export const sayUnoOnline = (id: string) => send((server) => server.sayUno(id))

// Resolves to true if the accused forgot to say UNO and had to draw
export const accuseOnline =
  (id: string, accused: number): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const before = getState().onlineGames.games[id]?.handSizes[accused]
    const after = await dispatch(send((server) => server.catchUnoFailure(id, accused)))
    return after !== undefined && before !== undefined && after.handSizes[accused]! > before
  }
