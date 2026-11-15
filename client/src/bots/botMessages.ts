import type { CardColor } from '@domain/model/card'
import type { PlayContext } from '@domain/model/rules'
import type { PlayDirection } from '@domain/model/turnOrder'

export type PlayerView = PlayContext & {
  readonly playerIndex: number
  readonly playerNames: readonly string[]
  readonly handSizes: readonly number[]
  readonly playerInTurn: number | undefined
  readonly direction: PlayDirection
  readonly drawPileSize: number
}

export type BotRequest =
  | { readonly type: 'chooseAction'; readonly requestId: number; readonly view: PlayerView }
  | {
      readonly type: 'considerUnoAccusation'
      readonly requestId: number
      readonly view: PlayerView
      readonly playerWithOneCard: number
    }

export type BotAction =
  | {
      readonly type: 'play'
      readonly cardIndex: number
      readonly color?: CardColor
      readonly sayUno: boolean
    }
  | { readonly type: 'draw' }
  | { readonly type: 'accuse'; readonly accused: number }
  | { readonly type: 'pass' }

export type BotResponse = { readonly requestId: number; readonly action: BotAction }
