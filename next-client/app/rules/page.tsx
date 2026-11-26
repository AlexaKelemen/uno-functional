// "/rules" - static (SSG) and a server component only: no data, no state,
// no interaction, so it is plain HTML built once and sends no page JavaScript.
import Link from 'next/link'

export default function RulesPage() {
  return (
    <main className="gamesPage">
      <h1>How to play</h1>
      <ul>
        <li>Everybody gets 7 cards. The first card of the draw pile starts the discard pile.</li>
        <li>On your turn, play a card with the same colour, number or symbol as the top card, or draw one.</li>
        <li>Skip, Reverse and Draw Two change who plays next. Wild cards let you pick the colour; Wild Draw Four only when you have no card of the current colour.</li>
        <li>Say UNO when you play your second-to-last card. If another player catches you, you draw 4.</li>
        <li>The first player out of cards wins the round and scores the cards left in the other hands.</li>
      </ul>
      <Link href="/">Back to setup</Link>
    </main>
  )
}
