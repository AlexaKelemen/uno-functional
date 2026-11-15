import type { Card, Color } from '@domain/model/deck.js'
import * as Round from '@domain/model/round.js'
import { toGraphQLError } from './graphQLErrors.js'
import type { ServerResponse } from './response.js'
import type {
  ActiveGame,
  Game,
  LobbyResponse,
  MoveResponse,
  PendingGame,
  StoreResponse,
} from './serverModel.js'

export type GraphQLActiveGame = {
  readonly id: string
  readonly pending: false
  readonly players: readonly string[]
  readonly playerInTurn: number | null
  readonly hands: readonly (readonly Card[])[]
  readonly handSizes: readonly number[]
  readonly topCard: Card
  readonly currentColor: Color
  readonly direction: PlayDirection
  readonly drawPileSize: number
  readonly winner: number | null
  readonly score: number | null
}

export type GraphQLGame = GraphQLActiveGame | PendingGame

export type PlayDirection = 'clockwise' | 'counterclockwise'

export const toPlayDirection = (direction: Round.Direction): PlayDirection =>
  direction === 1 ? 'clockwise' : 'counterclockwise'

export function toGraphQLGame({ id, round }: ActiveGame): GraphQLActiveGame {
  return {
    id,
    pending: false,
    players: round.players,
    playerInTurn: round.playerInTurn ?? null,
    hands: round.hands,
    handSizes: round.hands.map((hand) => hand.length),
    topCard: Round.topOfDiscard(round),
    currentColor: round.currentColor,
    direction: toPlayDirection(round.direction),
    drawPileSize: round.drawPile.length,
    winner: Round.winner(round) ?? null,
    score: Round.score(round) ?? null,
  }
}

export function handOfPlayer(
  game: GraphQLActiveGame,
  playerName: string | undefined,
): readonly Card[] | null {
  const seat = playerName === undefined ? -1 : game.players.indexOf(playerName)
  if (seat === -1) return null
  return game.hands[seat] ?? null
}

export function toGraphQLGameOrThrow(response: MoveResponse): Promise<GraphQLActiveGame> {
  return response.resolve({
    onSuccess: async (game) => toGraphQLGame(game),
    onError: async (error) => {
      throw toGraphQLError(error)
    },
  })
}

export function toGraphQLGameOrNull(response: StoreResponse): Promise<GraphQLActiveGame | null> {
  return response.resolve({
    onSuccess: async (game) => toGraphQLGame(game),
    onError: async () => null,
  })
}

export function toGraphQLAnyGame(game: Game): GraphQLGame {
  return game.pending ? game : toGraphQLGame(game)
}

export function gameTypeName(game: GraphQLGame): 'ActiveGame' | 'PendingGame' {
  return game.pending ? 'PendingGame' : 'ActiveGame'
}

export function valueOrThrow<Value>(response: LobbyResponse<Value>): Promise<Value> {
  return response.resolve({
    onSuccess: async (value) => value,
    onError: async (error) => {
      throw toGraphQLError(error)
    },
  })
}

export function valueOrNull<Value, Failure>(
  response: ServerResponse<Value, Failure>,
): Promise<Value | null> {
  return response.resolve({ onSuccess: async (value) => value, onError: async () => null })
}
