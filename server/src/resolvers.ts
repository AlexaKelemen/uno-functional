import { withFilter, type PubSub } from 'graphql-subscriptions'
import type { GameApi } from './api.js'
import { requirePlayerName, type GameContext } from './context.js'
import {
  gameUpdatedEvent,
  isUpdateForPlayer,
  pendingGamesUpdatedEvent,
  type GameUpdate,
} from './gameEvents.js'
import {
  gameTypeName,
  handOfPlayer,
  toGraphQLAnyGame,
  toGraphQLGameOrNull,
  toGraphQLGameOrThrow,
  valueOrNull,
  valueOrThrow,
  type GraphQLActiveGame,
  type GraphQLGame,
} from './graphQLGame.js'
import {
  CatchUnoFailureArguments,
  CreateGameArguments,
  GameIdArguments,
  PlayCardArguments,
  validateArguments,
} from './validation.js'

type NoParent = unknown

type NoArguments = unknown

export function createResolvers(pubsub: PubSub, api: GameApi) {
  return {
    Query: {
      async game(_: NoParent, args: unknown) {
        const { id } = validateArguments(GameIdArguments, args)
        const response = await api.findGame(id)
        return toGraphQLGameOrNull(response)
      },

      async pendingGame(_: NoParent, args: unknown) {
        const { id } = validateArguments(GameIdArguments, args)
        return valueOrNull(await api.findPendingGame(id))
      },

      pendingGames() {
        return api.pendingGames()
      },
    },

    Mutation: {
      async playCard(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id, cardIndex, color, sayUno } = validateArguments(PlayCardArguments, args)
        const response = await api.playCard(id, playerName, { cardIndex, color, sayUno })
        return toGraphQLGameOrThrow(response)
      },

      async drawCard(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id } = validateArguments(GameIdArguments, args)
        const response = await api.drawCard(id, playerName)
        return toGraphQLGameOrThrow(response)
      },

      async sayUno(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id } = validateArguments(GameIdArguments, args)
        const response = await api.sayUno(id, playerName)
        return toGraphQLGameOrThrow(response)
      },

      async catchUnoFailure(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id, accused } = validateArguments(CatchUnoFailureArguments, args)
        const response = await api.catchUnoFailure(id, playerName, accused)
        return toGraphQLGameOrThrow(response)
      },

      async createGame(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { numberOfPlayers } = validateArguments(CreateGameArguments, args)
        return valueOrThrow(await api.createGame(playerName, numberOfPlayers))
      },

      async joinGame(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id } = validateArguments(GameIdArguments, args)
        const game = await valueOrThrow(await api.joinGame(id, playerName))
        return toGraphQLAnyGame(game)
      },

      async leaveGame(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id } = validateArguments(GameIdArguments, args)
        return valueOrThrow(await api.leaveGame(id, playerName))
      },

      async startGame(_: NoParent, args: unknown, context: GameContext) {
        const playerName = requirePlayerName(context)
        const { id } = validateArguments(GameIdArguments, args)
        return toGraphQLGameOrThrow(await api.startPendingGame(id, playerName))
      },
    },

    Game: {
      __resolveType: (game: GraphQLGame) => gameTypeName(game),
    },

    ActiveGame: {
      hand(game: GraphQLActiveGame, _: NoArguments, context: GameContext) {
        return handOfPlayer(game, context.playerName)
      },
    },

    Subscription: {
      gameUpdated: {
        subscribe: withFilter(
          () => pubsub.asyncIterableIterator([gameUpdatedEvent]),
          (update: GameUpdate | undefined, _: NoArguments, context: GameContext | undefined) =>
            isUpdateForPlayer(update, context),
        ),
      },

      pendingGamesUpdated: {
        subscribe: () => pubsub.asyncIterableIterator([pendingGamesUpdatedEvent]),
      },
    },
  }
}
