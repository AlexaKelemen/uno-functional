import type { IncomingHttpHeaders } from 'node:http'
import { createGraphQLError } from './graphQLErrors.js'

export type GameContext = { readonly playerName: string | undefined }

const playerNameHeader = 'player-name'

function toPlayerName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmedName = value.trim()
  return trimmedName === '' ? undefined : trimmedName
}

export function contextFromHeaders(headers: IncomingHttpHeaders): GameContext {
  return { playerName: toPlayerName(headers[playerNameHeader]) }
}

export function contextFromConnectionParams(
  connectionParams: Readonly<Record<string, unknown>> | undefined,
): GameContext {
  return { playerName: toPlayerName(connectionParams?.playerName) }
}

export function requirePlayerName({ playerName }: GameContext): string {
  if (playerName === undefined) throw createGraphQLError('Forbidden', 'Forbidden')
  return playerName
}
