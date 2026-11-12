// Games waiting for players. The server pushes the whole list on every change.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PendingGame } from '../../api/gameServer'
import { loggedIn, loggedOut } from './sessionSlice'

export type LobbyState = Readonly<{
  pendingGames: readonly PendingGame[]
  // The game we are waiting in. Kept even after it leaves the list, so we can
  // tell that it started.
  waitingForId: string | undefined
  error: string
}>

const initialState: LobbyState = { pendingGames: [], waitingForId: undefined, error: '' }

export const lobbySlice = createSlice({
  name: 'lobby',
  initialState,
  reducers: {
    pendingGamesReceived: (state, action: PayloadAction<readonly PendingGame[]>): LobbyState => ({
      ...state,
      pendingGames: action.payload,
    }),
    waitingIn: (state, action: PayloadAction<string>): LobbyState => ({
      ...state,
      waitingForId: action.payload,
    }),
    stoppedWaiting: (state): LobbyState => ({ ...state, waitingForId: undefined }),
    failed: (state, action: PayloadAction<string>): LobbyState => ({ ...state, error: action.payload }),
    errorCleared: (state): LobbyState => ({ ...state, error: '' }),
  },
  // A new login is a new connection: start from scratch
  extraReducers: (builder) =>
    builder.addCase(loggedIn, () => initialState).addCase(loggedOut, () => initialState),
})

export const { pendingGamesReceived, waitingIn, stoppedWaiting, failed, errorCleared } = lobbySlice.actions
