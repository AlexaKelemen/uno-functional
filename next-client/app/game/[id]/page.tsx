// "/game/[id]" - an online game. Dynamic (SSR): a dynamic route that also
// reads the player cookie, so it is rendered on every request.
//
// This server component fetches the game from the GraphQL server as the
// player in the cookie sees it, and hands it to the client component. The
// page therefore arrives with the cards already on it; after hydration the
// client takes over with the live game and the server's pushes.
import Link from 'next/link'
import GameView from '@/components/views/GameView'
import { currentPlayer, loadGame } from '@/lib/server/gameServerFromServer'

export default async function OnlineGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await currentPlayer()

  if (player === undefined) {
    return (
      <main className="noGameSection">
        <div className="noGameContainer">
          <p>Log in to see game {id}.</p>
          <Link href="/">Go to setup</Link>
        </div>
      </main>
    )
  }

  const loaded = await loadGame(player, id)
  // If the server can't be reached now, the client still tries after hydration
  const initial = loaded.ok && loaded.value ? { game: loaded.value, renderedFor: player } : undefined

  return <GameView gameId={id} initial={initial} />
}
