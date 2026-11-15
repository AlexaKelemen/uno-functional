// Lobby actions that talk to the server.
import type { PendingGame } from '../../api/gameServer'
import type { AppThunk } from '../store'
import { errorCleared, failed, pendingGamesReceived, stoppedWaiting, waitingIn } from '../slices/lobbySlice'
import { gameReceived } from '../slices/onlineGamesSlice'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Runs a server call and stores any error message in the lobby state
const attempt =
  (action: AppThunk<Promise<void>>): AppThunk<Promise<void>> =>
  async (dispatch) => {
    dispatch(errorCleared())
    try {
      await dispatch(action)
    } catch (e) {
      dispatch(failed(message(e)))
    }
  }

export const refreshPendingGames = (): AppThunk<Promise<void>> =>
  attempt(async (dispatch, getState, connection) => {
    const games = await connection.require().pendingGames()
    dispatch(pendingGamesReceived(games))
    // After a reload, find the game we were already waiting in
    const { session, lobby } = getState()
    const mine = games.find((game) => session.playerName && game.players.includes(session.playerName))
    if (lobby.waitingForId === undefined && mine) dispatch(waitingIn(mine.id))
  })

// For the server's pendingGamesUpdated push (the RxJS subscription dispatches this).
export const receivePendingGames =
  (games: readonly PendingGame[]): AppThunk<Promise<void>> =>
  async (dispatch, getState, connection) => {
    dispatch(pendingGamesReceived(games))
    const id = getState().lobby.waitingForId
    // Our game left the list: either it started, or everybody else left
    if (id === undefined || games.some((game) => game.id === id) || getState().onlineGames.games[id]) return
    const started = await connection
      .require()
      .game(id)
      .catch(() => null)
    if (started) dispatch(gameReceived(started))
    else dispatch(stoppedWaiting())
  }

export const createGame = (numberOfPlayers: number): AppThunk<Promise<void>> =>
  attempt(async (dispatch, _getState, connection) => {
    const game = await connection.require().createGame(numberOfPlayers)
    dispatch(waitingIn(game.id))
  })

export const joinGame = (id: string): AppThunk<Promise<void>> =>
  attempt(async (dispatch, _getState, connection) => {
    const game = await connection.require().joinGame(id)
    if (!game.pending) dispatch(gameReceived(game))
    dispatch(waitingIn(game.id))
  })

export const leaveGame = (): AppThunk<Promise<void>> =>
  attempt(async (dispatch, getState, connection) => {
    const id = getState().lobby.waitingForId
    if (id === undefined) return
    await connection.require().leaveGame(id)
    dispatch(stoppedWaiting())
  })

// The creator starts the game before it is full
export const startGameNow = (): AppThunk<Promise<void>> =>
  attempt(async (dispatch, getState, connection) => {
    const id = getState().lobby.waitingForId
    if (id === undefined) return
    dispatch(gameReceived(await connection.require().startGame(id)))
  })
