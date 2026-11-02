# UNO, functional (WEB3 assignment 4)

UNO rules as immutable data and pure functions, using `lodash/fp`.

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
