// Logging in opens the connection to the server; logging out closes it.
// The name is kept in sessionStorage, so each browser tab can be a different
// player and survives a reload.
import type { AppThunk } from '../store'
import { loggedIn, loggedOut } from '../slices/sessionSlice'
import { gameReceived } from '../slices/onlineGamesSlice'
import { gameUpdates$, pendingGames$ } from '../../api/serverPushes'
import { receivePendingGames, refreshPendingGames } from './lobby'

const nameKey = 'uno.playerName'

const storage = (): Storage | undefined => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)

function readStoredName(): string | undefined {
  try {
    return storage()?.getItem(nameKey) ?? undefined
  } catch {
    return undefined
  }
}

function storeName(name: string | undefined) {
  try {
    if (name === undefined) storage()?.removeItem(nameKey)
    else storage()?.setItem(nameKey, name)
  } catch {
    // Storage can be blocked; the player just logs in again after a reload.
  }
}

export const login =
  (name: string): AppThunk =>
  (dispatch, _getState, connection) => {
    const trimmed = name.trim()
    if (trimmed === '') return
    const server = connection.open(trimmed)
    storeName(trimmed)
    dispatch(loggedIn(trimmed))
    // Listen to the server, so lobby changes and opponents' moves show up.
    // Ends when the connection closes (logout or a new login).
    const subscription = pendingGames$(server).subscribe((games) => void dispatch(receivePendingGames(games)))
    subscription.add(gameUpdates$(server).subscribe((game) => dispatch(gameReceived(game))))
    connection.listen(subscription)
    void dispatch(refreshPendingGames())
  }

export const logout = (): AppThunk => (dispatch, _getState, connection) => {
  connection.close()
  storeName(undefined)
  dispatch(loggedOut())
}

export const restoreSession = (): AppThunk => (dispatch) => {
  const name = readStoredName()
  if (name !== undefined) dispatch(login(name))
}
