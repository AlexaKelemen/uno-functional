import * as _ from 'lodash/fp'
import { Card, Color, Deck, createInitialDeck, hasColor, isWild, points } from './deck'
import { Shuffler, standardShuffler } from '../utils/random_utils'

export type Hand = readonly Card[]
export type Direction = 1 | -1
export type Accusation = Readonly<{ accuser: number; accused: number }>

export type Round = Readonly<{
  players: readonly string[]
  playerCount: number
  dealer: number
  hands: readonly Hand[]
  drawPile: Deck
  discardPile: Deck
  currentColor: Color
  direction: Direction
  playerInTurn: number | undefined
  saidUno: readonly number[]      // players whose "UNO!" still counts
  openToCatch: number | undefined // the player who can be accused right now
  shuffler: Shuffler<Card>
}>

type Transition = (round: Round) => Round

const MIN_PLAYERS = 2
const MAX_PLAYERS = 10

// ---------- Small helpers ----------

const fail = (message: string): never => {
  throw new Error(message)
}

const wrap = (size: number, index: number): number => ((index % size) + size) % size

const isPlayer = (player: number, round: Round): boolean =>
  _.isInteger(player) && _.inRange(0, round.playerCount, player)

const assertPlayer = (player: number, round: Round): void => {
  if (!isPlayer(player, round)) fail(`No such player: ${player}`)
}

const assertRunning = (round: Round): void => {
  if (hasEnded(round)) fail('The round has ended')
}

// ---------- Queries ----------

export const topOfDiscard = (round: Round): Card => round.discardPile[0]

export const winner = (round: Round): number | undefined => {
  const index = round.hands.findIndex(_.isEmpty)
  return index === -1 ? undefined : index
}

export const hasEnded = (round: Round): boolean => winner(round) !== undefined

export const score = (round: Round): number | undefined =>
  hasEnded(round) ? _.sumBy(points, _.flatten(round.hands)) : undefined

const matchesTop = (card: Card, hand: Hand, round: Round): boolean => {
  const top = topOfDiscard(round)
  switch (card.type) {
    case 'WILD':
      return true
    case 'WILD DRAW':
      return !hand.some(hasColor(round.currentColor))
    case 'NUMBERED':
      return hasColor(round.currentColor)(card) || (top.type === 'NUMBERED' && top.number === card.number)
    default:
      return hasColor(round.currentColor)(card) || top.type === card.type
  }
}

const handInTurn = (round: Round): Hand =>
  round.playerInTurn === undefined ? [] : round.hands[round.playerInTurn]

export const canPlay = _.curry((cardIndex: number, round: Round): boolean => {
  const hand = handInTurn(round)
  const card = hand[cardIndex]
  return card !== undefined && matchesTop(card, hand, round)
})

export const canPlayAny = (round: Round): boolean =>
  handInTurn(round).some((_card, index) => canPlay(index, round))

// ---------- Piles ----------

// The top of the discard pile stays; the rest becomes the new draw pile
const refillDrawPile: Transition = round =>
  _.isEmpty(round.drawPile) && round.discardPile.length > 1
    ? {
        ...round,
        drawPile: round.shuffler(_.tail(round.discardPile)),
        discardPile: _.take(1, round.discardPile),
      }
    : round

const drawOne = (player: number): Transition => round =>
  _.isEmpty(round.drawPile)
    ? round
    : _.flow([
        _.update(['hands', player], (hand: Hand) => [...hand, round.drawPile[0]]),
        _.update('drawPile', _.tail),
        refillDrawPile,
      ])(round)

const drawCards = (player: number, count: number): Transition =>
  _.flow(_.times(() => drawOne(player), count))

// ---------- Turn order ----------

const advance = (steps: number): Transition => round => ({
  ...round,
  playerInTurn: wrap(round.playerCount, round.playerInTurn! + steps * round.direction),
})

const reverse: Transition = round => ({ ...round, direction: -round.direction as Direction })

const nextPlayer = (round: Round): number => advance(1)(round).playerInTurn!

const penalizeNext = (count: number): Transition => round =>
  _.flow([drawCards(nextPlayer(round), count), advance(2)])(round)

// What a card does to the turn order. Also used for the starter card, with the
// dealer as the player in turn.
const applyEffect = (card: Card): Transition => round => {
  switch (card.type) {
    case 'SKIP':
      return advance(2)(round)
    case 'REVERSE':
      return _.flow([reverse, advance(round.playerCount === 2 ? 2 : 1)])(round)
    case 'DRAW':
      return penalizeNext(2)(round)
    case 'WILD DRAW':
      return penalizeNext(4)(round)
    default:
      return advance(1)(round)
  }
}

// ---------- UNO bookkeeping ----------

// Any play or draw ends the chance to catch the previous player, and voids
// every "UNO!" except the acting player's own
const recordAction = (player: number): Transition => round => ({
  ...round,
  openToCatch: undefined,
  saidUno: _.intersection(round.saidUno, [player]),
})

const recordCardsLeft = (player: number): Transition => round =>
  round.hands[player].length === 1 && !round.saidUno.includes(player)
    ? { ...round, openToCatch: player }
    : round

export const sayUno = _.curry((player: number, round: Round): Round => {
  assertRunning(round)
  assertPlayer(player, round)
  return {
    ...round,
    saidUno: _.union(round.saidUno, [player]),
    openToCatch: round.openToCatch === player ? undefined : round.openToCatch,
  }
})

export const checkUnoFailure = _.curry(({ accuser, accused }: Accusation, round: Round): boolean => {
  assertPlayer(accuser, round)
  assertPlayer(accused, round)
  return round.openToCatch === accused
})

export const catchUnoFailure = _.curry((accusation: Accusation, round: Round): Round =>
  checkUnoFailure(accusation, round)
    ? drawCards(accusation.accused, 4)({ ...round, openToCatch: undefined })
    : round
)

// ---------- Playing ----------

const assertLegalPlay = (cardIndex: number, color: Color | undefined, round: Round): void => {
  if (!canPlay(cardIndex, round)) fail('Illegal play')
  const wild = isWild(handInTurn(round)[cardIndex])
  if (wild && color === undefined) fail('A wild card needs a color')
  if (!wild && color !== undefined) fail('Only wild cards can name a color')
}

const moveToDiscard = (player: number, cardIndex: number, card: Card): Transition =>
  _.flow([
    _.update(['hands', player], (hand: Hand) => hand.filter((_card, index) => index !== cardIndex)),
    _.update('discardPile', (pile: Deck) => [card, ...pile]),
  ])

const endIfWon: Transition = round =>
  hasEnded(round) ? { ...round, playerInTurn: undefined } : round

export const play = _.curry((cardIndex: number, color: Color | undefined, round: Round): Round => {
  assertLegalPlay(cardIndex, color, round)
  const player = round.playerInTurn!
  const card = round.hands[player][cardIndex]
  return _.flow([
    recordAction(player),
    moveToDiscard(player, cardIndex, card),
    _.set('currentColor', isWild(card) ? color : card.color),
    recordCardsLeft(player),
    applyEffect(card),
    endIfWon,
  ])(round)
})

export const draw: Transition = round => {
  assertRunning(round)
  const player = round.playerInTurn!
  const drawn = _.flow([recordAction(player), drawOne(player)])(round) as Round
  const hand = drawn.hands[player]
  const drewCard = hand.length > round.hands[player].length
  return drewCard && canPlay(hand.length - 1, drawn) ? drawn : advance(1)(drawn)
}

// ---------- Setting up ----------

// Wild cards can't start a round, so the undealt cards are reshuffled until
// the top one is something else
const withoutWildOnTop = (shuffler: Shuffler<Card>, undealt: Deck): Deck =>
  isWild(undealt[0]) ? withoutWildOnTop(shuffler, shuffler(undealt)) : undealt

const dealHands = (cards: Deck, cardsPerPlayer: number, playerCount: number, dealer: number): readonly Hand[] => {
  const dealt = _.chunk(cardsPerPlayer, _.take(cardsPerPlayer * playerCount, cards))
  // Dealing starts with the player to the left of the dealer
  return _.times(player => dealt[wrap(playerCount, player - dealer - 1)], playerCount)
}

export function createRound(
  players: readonly string[],
  dealer: number,
  shuffler: Shuffler<Card> = standardShuffler,
  cardsPerPlayer: number = 7
): Round {
  if (!_.inRange(MIN_PLAYERS, MAX_PLAYERS + 1, players.length))
    fail(`UNO needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`)
  if (!_.isInteger(dealer) || !_.inRange(0, players.length, dealer)) fail(`No such dealer: ${dealer}`)

  const cards = shuffler(createInitialDeck())
  const [starter, ...drawPile] = withoutWildOnTop(shuffler, _.drop(cardsPerPlayer * players.length, cards))
  if (starter === undefined || isWild(starter)) return fail('Not enough cards to start a round')

  return applyEffect(starter)({
    players,
    playerCount: players.length,
    dealer,
    hands: dealHands(cards, cardsPerPlayer, players.length, dealer),
    drawPile,
    discardPile: [starter],
    currentColor: starter.color,
    direction: 1,
    playerInTurn: dealer,
    saidUno: [],
    openToCatch: undefined,
    shuffler,
  })
}
