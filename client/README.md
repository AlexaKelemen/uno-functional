# UNO client (WEB3 assignment 5)

React + Redux + RxJS client. It uses the functional model from assignment 4 (`../src/model`) through the `@model` alias.

    cd ..; npm install          # the model's own dependencies
    cd client; npm install
    npm test                    # Redux tests (vitest)
    npm run typecheck
    npm run dev                 # needs the server: cd ../server; npm start

## Redux (done)

Everything is in `src/redux`.

| File | Contents |
| --- | --- |
| `store.ts` | `store`, `makeStore(connection)`, `RootState`, `AppDispatch`, `AppThunk` |
| `hooks.ts` | `useAppDispatch`, `useAppSelector`: use these in components |
| `selectors.ts` | Everything components read, incl. `PlayerView` for both game types and `selectCanPlayCard(view, cardIndex)` |
| `slices/sessionSlice.ts` | `playerName` |
| `slices/lobbySlice.ts` | Pending games, the game we wait in, error |
| `slices/onlineGamesSlice.ts` | Online games by id (the server is the referee), error |
| `slices/localGameSlice.ts` | The game against bots. The reducers are the model's transitions |
| `thunks/session.ts` | `login`, `logout`, `restoreSession` |
| `thunks/lobby.ts` | `refreshPendingGames`, `createGame`, `joinGame`, `leaveGame`, `startGameNow`, `receivePendingGames` |
| `thunks/onlineGame.ts` | `loadGame`, `playOnline`, `drawOnline`, `sayUnoOnline`, `accuseOnline` |
| `thunks/localGame.ts` | `startLocalGame`, `playLocal`, `drawLocal`, `accuseLocal`, `endLocalGame`, `runBots` |

### How the functional model is used

- `localGame.round` is a model `Round` without its `shuffler` (functions don't go in Redux state).
- `played`, `drew`, `saidUno` and `accused` each run a model transition (`Round.play`, `Round.draw`, ...) on the round. An illegal move leaves the round unchanged and puts the model's error message in `localGame.error`.
- The reducers are pure. The dealer and a random seed are picked in the `started` action creator. The reducer builds a seeded shuffler from the seed and the move number, so the same state and action always give the same result. A test checks this.

### The server connection

The `GameServer` (from the assignment 3 client, `src/api/gameServer.ts`) is a live object, so it is kept outside the state in `src/api/connection.ts`. Thunks get it as their third argument: `(dispatch, getState, connection) => ...`.

## RxJS

The server pushes are Observables in `src/api/serverPushes.ts` (`pendingGames$`, `gameUpdates$`). `login` turns them into actions the same way as the lecturer's yahtzee-functional client:

    pendingGames$(server).pipe(map(receivePendingGames)).subscribe(dispatch)
    gameUpdates$(server).pipe(map(gameReceived)).subscribe(dispatch)

The subscription ends on logout or a new login.

## Bots (done)

Each bot runs in its own Web Worker (`src/bots`). It only gets a `PlayerView` and answers with a `BotAction` (`src/bots/botMessages.ts`). Its strategy (`botStrategy.ts`) uses the model's `canPlayCard`.

The bot runner is plain thunks in `src/redux/thunks/localGame.ts`:

- `startLocalGame({ playerName, botCount })` deals a round, starts one bot per seat and lets them play until it is the human's turn.
- `playLocal(cardIndex, color?, sayUno?)`, `drawLocal()`: the human's moves. The bots then get a chance to catch a missed UNO, and play their turns.
- `accuseLocal(seat)` returns whether the accused had forgotten UNO.
- `endLocalGame()` stops the bots.

Each of these resolves when it is the human's turn again (or the round is over), so a component can simply dispatch it. `selectBotsThinking` is true while the bots play.

While a bot is in turn the runner waits `thinkMs` (2 s), asks the bot, and dispatches `played` or `drew`. The model is the referee: anything it refuses becomes a draw. After a draw that keeps the turn, only the drawn card is played. The runner stops when `localGame.seed` changes or the round is gone, and the workers are terminated when the round is won, the game ends or a new one starts.

For tests, `createLocalGameThunks({ createBot, thinkMs, random })` makes the same thunks with other bots (see `src/redux/__tests__/fakeBots.ts`).

## React (done)

The views and components are ported from the Vue client. They read with `useAppSelector(selectX)` and act with `useAppDispatch()(thunkOrAction)`; none of them holds game state of its own.

### Routing

`react-router`, set up in `App.tsx`:

| Path | View |
| --- | --- |
| `/` | `SetupView`: name, then a game against 1-3 bots, or create/join an online lobby |
| `/lobby` | `LobbyView`: the lobby we wait in. The host starts the game |
| `/game` | `GameView` for the local game against bots |
| `/game/:gameId` | `GameView` for an online game |

### Views (`src/views`)

| File | Uses |
| --- | --- |
| `SetupView.tsx` | `login`, `startLocalGame`, `createGame`, `joinGame`, `selectLobbyError`. Goes to `/lobby` once `lobby.waitingForId` is set |
| `LobbyView.tsx` | `selectWaitingIn`, `selectStartedGameId`, `leaveGame`, `startGameNow`. Goes to `/game/:id` once the game starts, and clears `waitingForId` with `stoppedWaiting` |
| `GameView.tsx` | `useGameSource`, `selectCanPlayCard`. Keeps only UI state: the UNO toggle, the wild card waiting for a color, the last accusation message |

`src/hooks/useGameSource.ts` makes one `GameView` serve both kinds of game. It reads `gameId` from the URL and returns the same `{ view, mySeat, isMyTurn, winner, waitingText, error, play, draw, accuse, endLocalGame }` for both: without an id it uses t
he local selectors and thunks, with one the online ones (and loads the game with `loadGame`).

### Components (`src/components`)

Only props and callbacks, no Redux:

| Component | Props |
| --- | --- |
| `UnoCard` | `card`, `playable?`, `isTopCard?`, `onPlay?` |
| `DrawPile` | `isTurn`, `onDraw` |
| `UnoButton` | `sayUnoActive`, `isTurn`, `onToggle` |
| `OpponentWidget` | `name`, `handSize`, `isTurn`, `canAccuse?`, `onAccuse` |
| `ColorWheelWidget` | `currentColor?`, `selectable?`, `onSelectColor?` |

### CSS

`assets/main.css` (imported in `main.tsx`) has the colours as CSS variables, the page background and the base `.card` and `.ovalContainer` shapes that all cards share. Each component and view has its own `.css` file. Plain CSS is global, unlike Vue's `scoped`, so every rule that uses a shared name is nested under the component's root class (`.unoCard .ovalContainer`, `.topBarLobby .quitButton`, ...).
