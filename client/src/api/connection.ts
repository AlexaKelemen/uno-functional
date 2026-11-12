// The open connection to the game server. It is a live object (WebSocket,
// callbacks), so it is kept out of the Redux state. Thunks get it as their
// extra argument; the state only holds the player's name.
import { connectToGameServer, type GameServer } from './gameServer'

export type Connector = (playerName: string) => GameServer

export type Connection = {
  open(playerName: string): GameServer
  close(): void
  current(): GameServer | undefined
  require(): GameServer
}

export function createConnection(connect: Connector = connectToGameServer): Connection {
  let server: GameServer | undefined
  return {
    open(playerName) {
      server?.close()
      server = connect(playerName)
      return server
    },
    close() {
      server?.close()
      server = undefined
    },
    current: () => server,
    require() {
      if (!server) throw new Error('Not logged in')
      return server
    },
  }
}
