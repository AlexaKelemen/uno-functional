// Pure decision logic for a bot. No worker APIs here, so it's easy to unit test.
// The bot only ever sees a PlayerView: its own hand plus public information.
import { CARD_COLORS, type Card, type CardColor } from '@domain/model/card'
import { canCardBePlayed } from '@domain/model/rules'
import type { BotAction, PlayerView } from '@/shared/gameTypes'

export type Random = () => number

export type BotPersonality = {
  readonly forgetUnoChance: number // "should sometimes but not always forget to say Uno"
  readonly catchUnoChance: number // "should sometimes but not always catch" a missed Uno
}

export const defaultPersonality: BotPersonality = { forgetUnoChance: 0.25, catchUnoChance: 0.5 }

// Same rule check the engine uses, so the bot never picks an illegal card.
export function legalPlays(view: PlayerView): number[] {
  return view.hand.flatMap((card, i) => (canCardBePlayed(card, view) ? [i] : []))
}

// Prefer cards that hurt the next player; save wilds for when nothing else works.
function priority(card: Card): number {
  switch (card.type) {
    case 'DRAW':
      return 4
    case 'SKIP':
    case 'REVERSE':
      return 3
    case 'NUMBERED':
      return 2
    case 'WILD':
      return 1
    case 'WILD DRAW':
      return 0
  }
}

// Pick the colour the bot holds most of (random if it holds none).
export function bestColor(hand: readonly Card[], random: Random): CardColor {
  const counts = CARD_COLORS.map(
    (color) => hand.filter((c) => 'color' in c && c.color === color).length,
  )
  const max = Math.max(...counts)
  return max === 0
    ? CARD_COLORS[Math.floor(random() * CARD_COLORS.length)]!
    : CARD_COLORS[counts.indexOf(max)]!
}

export function chooseAction(
  view: PlayerView,
  personality: BotPersonality = defaultPersonality,
  random: Random = Math.random,
): BotAction {
  const plays = legalPlays(view)
  if (plays.length === 0) return { type: 'draw' }

  const cardIndex = plays.reduce((best, i) =>
    priority(view.hand[i]!) > priority(view.hand[best]!) ? i : best,
  )
  const card = view.hand[cardIndex]!
  const sayUno = view.hand.length === 2 && random() >= personality.forgetUnoChance

  if (card.type === 'WILD' || card.type === 'WILD DRAW') {
    const rest = view.hand.filter((_, i) => i !== cardIndex)
    return { type: 'play', cardIndex, color: bestColor(rest, random), sayUno }
  }
  return { type: 'play', cardIndex, sayUno }
}

export function considerUnoAccusation(
  playerWithOneCard: number,
  personality: BotPersonality = defaultPersonality,
  random: Random = Math.random,
): BotAction {
  return random() < personality.catchUnoChance
    ? { type: 'accuse', accused: playerWithOneCard }
    : { type: 'pass' }
}
