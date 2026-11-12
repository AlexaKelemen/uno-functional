// Copied from the assignment 3 client (UNO_game), with the card types now taken
// from the functional model.
// Talks to the GraphQL game server: queries and mutations over HTTP,
// subscriptions over a WebSocket. Every request carries the player's name.
import { createClient } from 'graphql-ws'
import type { Card, Color as CardColor } from '@model/deck'

export type OnlineGame = {
  readonly id: string
  readonly pending: false
  readonly players: readonly string[]
  readonly playerInTurn: number | null
  readonly hand: readonly Card[] | null
  readonly handSizes: readonly number[]
  readonly topCard: Card
  readonly currentColor: CardColor
  readonly direction: string
  readonly drawPileSize: number
  readonly winner: number | null
  readonly score: number | null
}

export type PendingGame = {
  readonly id: string
  readonly pending: true
  readonly creator: string
  readonly players: readonly string[]
  readonly numberOfPlayers: number
}

export type PlayMove = {
  readonly cardIndex: number
  readonly color: CardColor | undefined
  readonly sayUno: boolean
}

export type ServerUrls = { readonly httpUrl: string; readonly webSocketUrl: string }

export interface GameServer {
  pendingGames(): Promise<PendingGame[]>
  game(id: string): Promise<OnlineGame | null>
  createGame(numberOfPlayers: number): Promise<PendingGame>
  joinGame(id: string): Promise<PendingGame | OnlineGame>
  leaveGame(id: string): Promise<void>
  startGame(id: string): Promise<OnlineGame>
  playCard(id: string, move: PlayMove): Promise<OnlineGame>
  drawCard(id: string): Promise<OnlineGame>
  sayUno(id: string): Promise<OnlineGame>
  catchUnoFailure(id: string, accused: number): Promise<OnlineGame>
  onPendingGames(listener: (games: PendingGame[]) => void): () => void
  onGameUpdated(listener: (game: OnlineGame) => void): () => void
  close(): void
}

export class GameServerError extends Error {
  readonly code: string | undefined

  constructor(message: string, code: string | undefined) {
    super(message)
    this.code = code
  }
}

const serverHttpUrl: string =
  import.meta.env.VITE_GAME_SERVER_URL ?? 'http://localhost:4000/graphql'

export const defaultServerUrls: ServerUrls = {
  httpUrl: serverHttpUrl,
  webSocketUrl: serverHttpUrl.replace(/^http/, 'ws'),
}

const cardFields = 'type color number'
const onlineGameFields = `id pending players playerInTurn hand { ${cardFields} } handSizes
  topCard { ${cardFields} } currentColor direction drawPileSize winner score`
const pendingGameFields = 'id pending creator players numberOfPlayers'

// GraphQL sends absent fields as null (a wild card has `color: null`); the
// domain's Card type leaves them out instead.
type ServerCard = { type: Card['type']; color: CardColor | null; number: number | null }

function toCard({ type, color, number }: ServerCard): Card {
  const card: Record<string, unknown> = { type }
  if (color !== null) card.color = color
  if (number !== null) card.number = number
  return card as Card
}

type ServerOnlineGame = Omit<OnlineGame, 'hand' | 'topCard'> & {
  hand: ServerCard[] | null
  topCard: ServerCard
}

function toOnlineGame(game: ServerOnlineGame): OnlineGame {
  return { ...game, hand: game.hand?.map(toCard) ?? null, topCard: toCard(game.topCard) }
}

type GraphQLResult<Data> = {
  data?: Data | null
  errors?: readonly { message: string; extensions?: { code?: string } }[]
}

export function connectToGameServer(
  playerName: string,
  { httpUrl, webSocketUrl }: ServerUrls = defaultServerUrls,
): GameServer {
  const subscriptions = createClient({ url: webSocketUrl, connectionParams: { playerName } })

  async function request<Data>(query: string, variables: Record<string, unknown> = {}) {
    const response = await fetch(httpUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'player-name': playerName },
      body: JSON.stringify({ query, variables }),
    })
    const { data, errors }: GraphQLResult<Data> = await response.json()
    const [error] = errors ?? []
    if (error) throw new GameServerError(error.message, error.extensions?.code)
    if (!data) throw new GameServerError(`Server answered ${response.status}`, undefined)
    return data
  }

  async function move(field: string, args: string, variables: Record<string, unknown>) {
    const data = await request<Record<string, ServerOnlineGame>>(
      `mutation (${args}) { ${field}(${argsToFields(args)}) { ${onlineGameFields} } }`,
      variables,
    )
    return toOnlineGame(data[field]!)
  }

  function subscribe<Data>(query: string, onData: (data: Data) => void): () => void {
    return subscriptions.subscribe<Data>(
      { query },
      {
        next: ({ data }) => data && onData(data),
        error: (error) => console.error('Subscription failed', error),
        complete: () => {},
      },
    )
  }

  return {
    async pendingGames() {
      const data = await request<{ pendingGames: PendingGame[] }>(
        `{ pendingGames { ${pendingGameFields} } }`,
      )
      return data.pendingGames
    },

    async game(id) {
      const data = await request<{ game: ServerOnlineGame | null }>(
        `query ($id: ID!) { game(id: $id) { ${onlineGameFields} } }`,
        { id },
      )
      return data.game && toOnlineGame(data.game)
    },

    async createGame(numberOfPlayers) {
      const data = await request<{ createGame: PendingGame }>(
        `mutation ($numberOfPlayers: Int!) {
          createGame(numberOfPlayers: $numberOfPlayers) { ${pendingGameFields} }
        }`,
        { numberOfPlayers },
      )
      return data.createGame
    },

    async joinGame(id) {
      const data = await request<{ joinGame: PendingGame | ServerOnlineGame }>(
        `mutation ($id: ID!) { joinGame(id: $id) {
          ... on PendingGame { ${pendingGameFields} }
          ... on ActiveGame { ${onlineGameFields} }
        } }`,
        { id },
      )
      const game = data.joinGame
      return game.pending ? game : toOnlineGame(game)
    },

    async leaveGame(id) {
      await request('mutation ($id: ID!) { leaveGame(id: $id) }', { id })
    },

    startGame: (id) => move('startGame', '$id: ID!', { id }),

    playCard: (id, { cardIndex, color, sayUno }) =>
      move('playCard', '$id: ID!, $cardIndex: Int!, $color: String, $sayUno: Boolean!', {
        id,
        cardIndex,
        color: color ?? null,
        sayUno,
      }),

    drawCard: (id) => move('drawCard', '$id: ID!', { id }),

    sayUno: (id) => move('sayUno', '$id: ID!', { id }),

    catchUnoFailure: (id, accused) =>
      move('catchUnoFailure', '$id: ID!, $accused: Int!', { id, accused }),

    onPendingGames(listener) {
      return subscribe<{ pendingGamesUpdated: PendingGame[] }>(
        `subscription { pendingGamesUpdated { ${pendingGameFields} } }`,
        (data) => listener(data.pendingGamesUpdated),
      )
    },

    onGameUpdated(listener) {
      return subscribe<{ gameUpdated: ServerOnlineGame | null }>(
        `subscription { gameUpdated { ${onlineGameFields} } }`,
        (data) => data.gameUpdated && listener(toOnlineGame(data.gameUpdated)),
      )
    },

    close() {
      void subscriptions.dispose()
    },
  }
}

// '$id: ID!, $accused: Int!' -> 'id: $id, accused: $accused'
function argsToFields(args: string): string {
  return args
    .split(',')
    .map((arg) => arg.split(':')[0]!.trim().slice(1))
    .map((name) => `${name}: $${name}`)
    .join(', ')
}
