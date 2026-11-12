// The open connection to the game server. It is a live object (WebSocket,
// callbacks), so it is kept out of the Redux state. Thunks get it as their
// extra argument; the state only holds the player's name.
import type { Subscription } from 'rxjs'
import { connectToGameServer, type GameServer } from './gameServer'

export type Connector = (playerName: string) => GameServer

export type Connection = {
  open(playerName: string): GameServer
  close(): void
  current(): GameServer | undefined
  require(): GameServer
  // Keeps the subscription to the server's pushes, so it ends with the connection
  listen(subscription: Subscription): void
}

export function createConnection(connect: Connector = connectToGameServer): Connection {
  let server: GameServer | undefined
  let subscription: Subscription | undefined

  const close = () => {
    subscription?.unsubscribe()
    subscription = undefined
    server?.close()
    server = undefined
  }

  return {
    open(playerName) {
      close()
      server = connect(playerName)
      return server
    },
    close,
    current: () => server,
    require() {
      if (!server) throw new Error('Not logged in')
      return server
    },
    listen(next) {
      subscription?.unsubscribe()
      subscription = next
    },
  }
}
