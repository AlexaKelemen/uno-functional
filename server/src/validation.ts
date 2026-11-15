import { CARD_COLORS } from '@domain/model/card.js'
import * as z from 'zod'
import { createGraphQLError } from './graphQLErrors.js'
import { maxPlayers, minPlayers } from './serverModel.js'

export const GameIdArguments = z.object({ id: z.string().min(1) })

export const PlayCardArguments = GameIdArguments.extend({
  cardIndex: z.number().int().nonnegative(),
  color: z
    .enum(CARD_COLORS)
    .nullish()
    .transform((color) => color ?? undefined),
  sayUno: z.boolean(),
})

export const CatchUnoFailureArguments = GameIdArguments.extend({
  accused: z.number().int().nonnegative(),
})

export const CreateGameArguments = z.object({
  numberOfPlayers: z.number().int().min(minPlayers).max(maxPlayers),
})

export function validateArguments<Output>(schema: z.ZodType<Output>, args: unknown): Output {
  const result = schema.safeParse(args)
  if (!result.success) throw createGraphQLError(z.prettifyError(result.error), 'Bad Request')
  return result.data
}
