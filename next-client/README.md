# UNO in Next.js (WEB3 assignment 6)

The React/Redux/RxJS client from assignment 5 (`../client`), ported to Next.js
with server-side rendering. It uses the same functional model (`../src/model`)
and the same GraphQL server (`../server`).

## Run

From the repository root, install once:

    npm install
    cd server && npm install && cd ..
    cd next-client && npm install && cd ..

Start the game server, then Next.js in either mode:

    cd server && npm start                       # http://localhost:4000/graphql
    cd next-client && npm run dev                # development, http://localhost:3000
    cd next-client && npm run build && npm run start   # production

Set `NEXT_PUBLIC_GAME_SERVER_URL` (see `.env.example`) if the server is not on
`http://localhost:4000/graphql`.

To play online against yourself, use two different browsers (or a private
window): the player name is kept in a cookie, and cookies are shared between
tabs of the same browser.

## Pages: static or dynamic

`npm run build` lists every route as static (○) or dynamic (ƒ):

| Route | Rendering | Why |
| --- | --- | --- |
| `/` setup | static (SSG) | No data. The form is a client component. |
| `/lobby` | static (SSG) | Which lobby you wait in only exists in the browser (Redux, live pushes through RxJS). |
| `/game` local game | static (SSG) | The whole game runs in the browser: model in Redux, bots in Web Workers. |
| `/rules` | static (SSG) | Plain server component: no state, no data, no interaction. |
| `/game/[id]` online game | dynamic (SSR) | Dynamic route, and it reads the player cookie. The server fetches the game as that player sees it, so the page arrives with the cards on it. |
| `/games` open lobbies | dynamic (SSR) | The list changes all the time, so static HTML would be stale. Reads the cookie. |

## Server and client components

- **Server components** (no `'use client'`): `app/layout.tsx`, all `page.tsx`
  files, and `lib/server/gameServerFromServer.ts` (imports `server-only`).
  They can be `async` and fetch data, but have no hooks or state.
- **Client components** (`'use client'`): `app/StoreProvider.tsx`, the views
  in `components/views/`, `components/JoinButton.tsx`, and everything they
  import (cards, pile, colour wheel). They use hooks, Redux and the WebSocket.

The data goes from server to client as props. `/game/[id]/page.tsx` loads the
game on the server and passes it to `GameView` as `initial`; the client shows
it until the live game is in the Redux store.

## State

- One Redux store per browser, made in `StoreProvider` with `useState`. No
  module-level store: on the server it would be shared by all requests.
- The session is restored in `useEffect`, after hydration. The first client
  render then matches the server's HTML (nobody logged in), so there are no
  hydration errors.
- The player name goes into `sessionStorage` (for the client, per tab) and a
  cookie (`uno-player`), which the server reads with `cookies()` from
  `next/headers`.
- The WebSocket subscriptions (RxJS, `lib/api/serverPushes.ts`) and the bot
  Web Workers only start in the browser, from thunks that run on user
  actions or in effects.

## What changed from assignment 5

- `react-router` → Next.js App Router (`app/` folders, `next/link`,
  `useRouter` from `next/navigation`). The game id comes in as a page param
  instead of `useParams`.
- `import.meta.env.VITE_…` → `process.env.NEXT_PUBLIC_…`.
- `lib/` holds the assignment 5 code (`redux`, `api`, `bots`, `hooks`) almost
  unchanged.
- `next.config.ts` sets the repository root as the bundler root, so `@model`
  can import the functional model from `../src`. Cache Components is turned
  off, so the static/dynamic rules are the ones from the lectures.
