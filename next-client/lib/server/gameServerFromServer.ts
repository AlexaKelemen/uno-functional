import 'server-only'
// The game server, called from the Next.js server while it renders a page.
// Same GraphQL API as in the browser, but only plain queries over HTTP: the
// subscription WebSocket is created lazily, so it is never opened here.
import { cookies } from 'next/headers'
import { connectToGameServer, type OnlineGame, type PendingGame } from '@/lib/api/gameServer'
import { playerCookieName } from '@/lib/playerCookie'

// Reading cookies() is a run-time API: any page that calls this is rendered
// dynamically, on every request.
export async function currentPlayer(): Promise<string | undefined> {
  const value = (await cookies()).get(playerCookieName)?.value
  return value === undefined || value.trim() === '' ? undefined : value
}

async function ask<T>(player: string, question: (server: ReturnType<typeof connectToGameServer>) => Promise<T>) {
  const server = connectToGameServer(player)
  try {
    return await question(server)
  } finally {
    server.close()
  }
}

export type Loaded<T> = { ok: true; value: T } | { ok: false; error: string }

const failure = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
})

export async function loadGame(player: string, id: string): Promise<Loaded<OnlineGame | null>> {
  try {
    return { ok: true, value: await ask(player, (server) => server.game(id)) }
  } catch (e) {
    return failure(e)
  }
}

export async function loadPendingGames(player: string): Promise<Loaded<PendingGame[]>> {
  try {
    return { ok: true, value: await ask(player, (server) => server.pendingGames()) }
  } catch (e) {
    return failure(e)
  }
}
