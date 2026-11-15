import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { expressMiddleware } from '@as-integrations/express5'
import { standardRandomizer, type Randomizer } from '@domain/utils/random_utils.js'
import cors from 'cors'
import express from 'express'
import type { GraphQLSchema } from 'graphql'
import { PubSub } from 'graphql-subscriptions'
import type { Disposable } from 'graphql-ws'
import { useServer } from 'graphql-ws/use/ws'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'
import { GameApi } from './api.js'
import { contextFromConnectionParams, contextFromHeaders, type GameContext } from './context.js'
import { createPubSubBroadcaster } from './gameEvents.js'
import { createGameSchema } from './schema.js'
import type { GameStore } from './serverModel.js'

export type GameServerOptions = {
  readonly store: GameStore
  readonly port: number
  readonly randomizer?: Randomizer
}

export type RunningGameServer = {
  readonly httpUrl: string
  readonly webSocketUrl: string
  stop(): Promise<void>
}

const graphQLPath = '/graphql'

function serveSubscriptionsOverWebSocket(httpServer: Server, schema: GraphQLSchema): Disposable {
  const webSocketServer = new WebSocketServer({ server: httpServer, path: graphQLPath })
  return useServer(
    { schema, context: (connection) => contextFromConnectionParams(connection.connectionParams) },
    webSocketServer,
  )
}

async function startApolloServer(
  httpServer: Server,
  schema: GraphQLSchema,
  subscriptionServer: Disposable,
): Promise<ApolloServer<GameContext>> {
  const apolloServer = new ApolloServer<GameContext>({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await subscriptionServer.dispose()
            },
          }
        },
      },
    ],
  })
  await apolloServer.start()
  return apolloServer
}

async function listenOnPort(httpServer: Server, port: number): Promise<number> {
  await new Promise<void>((resolve) => httpServer.listen(port, resolve))
  const { port: boundPort } = httpServer.address() as AddressInfo
  return boundPort
}

export async function startGameServer({
  store,
  port,
  randomizer = standardRandomizer,
}: GameServerOptions): Promise<RunningGameServer> {
  const pubsub = new PubSub()
  const api = new GameApi(createPubSubBroadcaster(pubsub), store, randomizer)
  const schema = await createGameSchema(pubsub, api)

  const app = express()
  const httpServer = createServer(app)
  const subscriptionServer = serveSubscriptionsOverWebSocket(httpServer, schema)
  const apolloServer = await startApolloServer(httpServer, schema, subscriptionServer)

  app.use(
    graphQLPath,
    cors({ origin: /:\/\/localhost:/, methods: ['GET', 'POST', 'OPTIONS'] }),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => contextFromHeaders(req.headers),
    }),
  )

  const boundPort = await listenOnPort(httpServer, port)
  return {
    httpUrl: `http://localhost:${boundPort}${graphQLPath}`,
    webSocketUrl: `ws://localhost:${boundPort}${graphQLPath}`,
    stop: () => apolloServer.stop(),
  }
}
