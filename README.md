# UNO, functional (WEB3 assignments 4 and 5)

UNO rules as immutable data and pure functions, using `lodash/fp` (assignment 4), with a GraphQL server and a React/Redux/RxJS client built on them (assignment 5).

| Folder | Contents | Tests |
| --- | --- | --- |
| `src/model` | The functional model: `deck.ts`, `round.ts`, `uno.ts` | jest, `__test__/` |
| `server` | GraphQL server (Apollo, graphql-ws). Games are functional `Round`s | vitest |
| `client` | React + Redux + RxJS client. Local games against bots run the model in the browser | vitest |

The server and the client both import the model from `src`, so all three use the same code.

## Install

The model's dependencies (lodash) are installed at the root. The server and the client import the model from `../src`, so install the root first:

    npm install
    cd server && npm install && cd ..
    cd client && npm install && cd ..

## Run

    cd server && npm start      # http://localhost:4000/graphql, ws://localhost:4000/graphql
    cd client && npm run dev    # Vite dev server, http://localhost:5173

The client talks to `http://localhost:4000/graphql` unless `VITE_GAME_SERVER_URL` says otherwise. The server starts with one seeded game (id `0`, Alice vs. Bob) to try by hand.

## Test

    npm test && npm run typecheck                            # model (jest, tsc)
    cd server && npx vitest run && npm run type-check        # server
    cd client && npm test && npm run typecheck               # client

`npm test` in `server` starts vitest in watch mode; `npx vitest run` runs once.

## Todo

- The model does not enforce that only the drawn card may be played after a draw that keeps the turn. The bot runner enforces it for the bots; a human, locally or online, may play any matching card.

# The functional model (assignment 4)

    npm install
    npm test            # jest
    npm run typecheck   # tsc

## Structure

| File | Contents |
| --- | --- |
| `src/model/deck.ts` | Card types, the 108-card deck, card helpers |
| `src/model/round.ts` | `Round` type and everything that happens in a round |
| `src/model/uno.ts` | `Game` type: scores, new rounds, winning |
| `__test__/model/purity.test.ts` | Our own tests: frozen inputs, and full random games |

## How it works

- Every type is `Readonly`. No function changes its input. Each returns a new value.
- There are no classes, `this` or loops. Transitions are `Round => Round` functions composed with `_.flow`.
- `play`, `sayUno`, `canPlay`, `checkUnoFailure` and `catchUnoFailure` are curried, with the round as the last argument, so `play(0, undefined)` is a transition you can compose.
- `canPlayCard(card, hand, topCard, currentColor)` is the play rule without a `Round`. `canPlay` uses it, and so do the client and the bots, which only see a player's view.
- `uno.play(action, game)` runs any transition on the current round, then handles scoring and the next round.

## Rule decisions

- The deal starts with the player left of the dealer, and the dealer moves one seat left each round. The game tests rely on this.
- The draw pile refills as soon as its last card is taken, not on the next draw.
- `draw` is always allowed, even when the player could play.
- A wild starter means the undealt cards are reshuffled, not the whole deck. Hands stay as dealt.
- The starter card uses the same effect function as a played card. So with 2 players, a reverse starter acts as a skip and the dealer goes first.
- A wrong UNO accusation has no penalty. The round comes back unchanged.

## Purity caveat

`Round` stores the shuffler, because `draw` may need to reshuffle. So the model is pure only when the shuffler is. `standardShuffler` uses `Math.random`, which makes it the one impure piece, and it is passed in from outside. Pass a seeded shuffler (as `purity.test.ts` does) and every function is fully deterministic.
