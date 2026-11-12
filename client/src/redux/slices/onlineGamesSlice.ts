// Games played against other people through the server. The server is the
// referee: this slice only keeps the latest state of each game it was sent.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { OnlineGame } from '../../api/gameServer'
import { loggedIn, loggedOut } from './sessionSlice'

export type OnlineGamesState = Readonly<{
  games: Readonly<Record<string, OnlineGame>>
  error: string
}>

const initialState: OnlineGamesState = { games: {}, error: '' }

export const onlineGamesSlice = createSlice({
  name: 'onlineGames',
  initialState,
  reducers: {
    // A game arrived: as a server push, or as the answer to one of our moves
    gameReceived: (state, action: PayloadAction<OnlineGame>): OnlineGamesState => ({
      ...state,
      games: { ...state.games, [action.payload.id]: action.payload },
    }),
    failed: (state, action: PayloadAction<string>): OnlineGamesState => ({ ...state, error: action.payload }),
    errorCleared: (state): OnlineGamesState => ({ ...state, error: '' }),
  },
  extraReducers: (builder) =>
    builder.addCase(loggedIn, () => initialState).addCase(loggedOut, () => initialState),
})

export const { gameReceived, failed, errorCleared } = onlineGamesSlice.actions
