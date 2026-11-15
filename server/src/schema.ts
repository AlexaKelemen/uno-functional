import { makeExecutableSchema } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import type { PubSub } from 'graphql-subscriptions'
import { readFile } from 'node:fs/promises'
import type { GameApi } from './api.js'
import { createResolvers } from './resolvers.js'

export async function createGameSchema(pubsub: PubSub, api: GameApi): Promise<GraphQLSchema> {
  const typeDefs = await readFile(new URL('../uno.sdl', import.meta.url), 'utf8')
  return makeExecutableSchema({ typeDefs, resolvers: createResolvers(pubsub, api) })
}
