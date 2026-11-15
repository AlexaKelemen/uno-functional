import { GraphQLError } from 'graphql'
import type { ServerError } from './serverModel.js'

export function createGraphQLError(message: string, code: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

export function toGraphQLError(error: ServerError): GraphQLError {
  const message = 'reason' in error ? error.reason : error.type
  return createGraphQLError(message, error.type)
}
