import * as _ from 'lodash/fp'

export const colors = ['BLUE', 'GREEN', 'RED', 'YELLOW'] as const
export type Color = (typeof colors)[number]

export type NumberedCard = Readonly<{ type: 'NUMBERED'; color: Color; number: number }>
export type SkipCard = Readonly<{ type: 'SKIP'; color: Color }>
export type ReverseCard = Readonly<{ type: 'REVERSE'; color: Color }>
export type DrawCard = Readonly<{ type: 'DRAW'; color: Color }>
export type WildCard = Readonly<{ type: 'WILD' }>
export type WildDrawCard = Readonly<{ type: 'WILD DRAW' }>

export type Card = NumberedCard | SkipCard | ReverseCard | DrawCard | WildCard | WildDrawCard
export type Type = Card['type']

// Index 0 is the top of the pile
export type Deck = readonly Card[]

const twice = <T>(t: T): readonly T[] => [t, t]

const numberedCards = (color: Color): Deck =>
  [0, ..._.flatMap(twice, _.range(1, 10))].map(number => ({ type: 'NUMBERED', color, number }))

const actionCards = (color: Color): Deck =>
  _.flatMap<Card, Card>(twice, [
    { type: 'SKIP', color },
    { type: 'REVERSE', color },
    { type: 'DRAW', color },
  ])

const fourOf = (card: Card): Deck => _.times(() => card, 4)

export const createInitialDeck = (): Deck => [
  ...colors.flatMap(color => [...numberedCards(color), ...actionCards(color)]),
  ...fourOf({ type: 'WILD' }),
  ...fourOf({ type: 'WILD DRAW' }),
]

export const isWild = (card: Card): card is WildCard | WildDrawCard =>
  card.type === 'WILD' || card.type === 'WILD DRAW'

export const hasColor = (color: Color) => (card: Card): boolean =>
  !isWild(card) && card.color === color

export const points = (card: Card): number => {
  switch (card.type) {
    case 'NUMBERED':
      return card.number
    case 'WILD':
    case 'WILD DRAW':
      return 50
    default:
      return 20
  }
}
