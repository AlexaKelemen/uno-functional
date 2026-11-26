// "/games" - the open lobbies. Dynamic (SSR): the list changes all the time,
// and reading the player cookie makes the page render on every request.
// The list is rendered on the server; only the Join buttons are client
// components. Static HTML here would show a stale list.
import Link from 'next/link'
import JoinButton from '@/components/JoinButton'
import { currentPlayer, loadPendingGames } from '@/lib/server/gameServerFromServer'
import './games.css'

export default async function OpenGamesPage() {
  const player = await currentPlayer()
  const loaded = player === undefined ? undefined : await loadPendingGames(player)

  return (
    <main className="gamesPage">
      <h1>Open lobbies</h1>
      {player === undefined ? (
        <p>Enter your name in multiplayer mode on the setup screen first.</p>
      ) : !loaded?.ok ? (
        <p className="errorLabel">Could not reach the game server: {loaded?.error}</p>
      ) : loaded.value.length === 0 ? (
        <p>No open lobbies right now. Create one from the setup screen.</p>
      ) : (
        <ul className="gamesList">
          {loaded.value.map((game) => (
            <li key={game.id}>
              <span>
                {game.creator}&apos;s game ({game.players.length}/{game.numberOfPlayers}) - code {game.id}
              </span>
              {game.players.includes(player) ? (
                <Link href="/lobby">You are in it</Link>
              ) : (
                <JoinButton gameId={game.id} />
              )}
            </li>
          ))}
        </ul>
      )}
      <p>
        Rendered on the server{player ? ` for ${player}` : ''} at {new Date().toLocaleTimeString('en-GB')}.{' '}
        <Link href="/">Back to setup</Link>
      </p>
    </main>
  )
}
