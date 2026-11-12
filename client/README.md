# UNO client (WEB3 assignment 5)

React + Redux + RxJS client. It uses the functional model from assignment 4 (`../src/model`) through the `@model` alias.

    cd ..; npm install          # the model's own dependencies
    cd client; npm install
    npm test                    # Redux tests (vitest)
    npm run typecheck
    npm run dev

## Redux (done)

Everything is in `src/redux`.

| File | Contents |
| --- | --- |
| `store.ts` | `store`, `makeStore(connection)`, `RootState`, `AppDispatch`, `AppThunk` |
| `hooks.ts` | `useAppDispatch`, `useAppSelector`: use these in components |
| `selectors.ts` | Everything components read, incl. `PlayerView` for both game types |
| `slices/sessionSlice.ts` | `playerName` |
| `slices/lobbySlice.ts` | Pending games, the game we wait in, error |
| `slices/onlineGamesSlice.ts` | Online games by id (the server is the referee), error |
| `slices/localGameSlice.ts` | The game against bots. The reducers are the model's transitions |
| `thunks/session.ts` | `login`, `logout`, `restoreSession` |
| `thunks/lobby.ts` | `refreshPendingGames`, `createGame`, `joinGame`, `leaveGame`, `startGameNow`, `receivePendingGames` |
| `thunks/onlineGame.ts` | `loadGame`, `playOnline`, `drawOnline`, `sayUnoOnline`, `accuseOnline` |

### How the functional model is used

- `localGame.round` is a model `Round` without its `shuffler` (functions don't go in Redux state).
- `played`, `drew`, `saidUno` and `accused` each run a model transition (`Round.play`, `Round.draw`, ...) on the round. An illegal move leaves the round unchanged and puts the model's error message in `localGame.error`.
- The reducers are pure. The dealer and a random seed are picked in the `started` action creator. The reducer builds a seeded shuffler from the seed and the move number, so the same state and action always give the same result. A test checks this.

### The server connection

The `GameServer` (from the assignment 3 client, `src/api/gameServer.ts`) is a live object, so it is kept outside the state in `src/api/connection.ts`. Thunks get it as their third argument: `(dispatch, getState, connection) => ...`.

## RxJS

The server pushes are Observables in `src/api/serverPushes.ts` (`pendingGames$`, `gameUpdates$`). `login` subscribes to them and dispatches `receivePendingGames` / `gameReceived`. The subscription ends on logout or a new login.

Still todo: the bot runner (`client/src/game/botRunner.ts` in UNO_game) still needs porting too. It can dispatch `played`, `drew`, `accused` and `botsThinkingChanged`, and read `selectLocalViewFor(state, seat)`.

## React (todo)

Port the views and components from the Vue client. Read with `useAppSelector(selectX)` and act with `useAppDispatch()(thunkOrAction)`. `App.tsx` is only a placeholder.
