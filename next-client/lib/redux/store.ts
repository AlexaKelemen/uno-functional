import { combineReducers, configureStore, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit'
import { createConnection, type Connection } from '../api/connection'
import { sessionSlice } from './slices/sessionSlice'
import { lobbySlice } from './slices/lobbySlice'
import { onlineGamesSlice } from './slices/onlineGamesSlice'
import { localGameSlice } from './slices/localGameSlice'

export const rootReducer = combineReducers({
  session: sessionSlice.reducer,
  lobby: lobbySlice.reducer,
  onlineGames: onlineGamesSlice.reducer,
  localGame: localGameSlice.reducer,
})

export type RootState = ReturnType<typeof rootReducer>

// Thunks get the server connection as their extra argument, so tests can pass
// in a fake server.
export function makeStore(connection: Connection = createConnection()) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: connection } }),
  })
}

// No store singleton here: with Next.js this module is also loaded on the
// server, where one shared store would leak state between requests. Each
// browser gets its own store from app/StoreProvider.tsx instead.

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
export type AppThunk<Result = void> = ThunkAction<Result, RootState, Connection, UnknownAction>
