// Who the player is. The server connection itself lives outside the state
// (see api/connection.ts); logging in and out is done by the thunks in
// thunks/session.ts.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type SessionState = Readonly<{
  playerName: string | undefined
}>

const initialState: SessionState = { playerName: undefined }

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    loggedIn: (_state, action: PayloadAction<string>): SessionState => ({ playerName: action.payload }),
    loggedOut: (): SessionState => initialState,
  },
})

export const { loggedIn, loggedOut } = sessionSlice.actions
