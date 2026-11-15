import type { Color as CardColor } from '@model/deck'
import type { PlayerView } from '@/redux/selectors'

export type { PlayerView }

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
