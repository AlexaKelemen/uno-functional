import { startGameServer } from './gameServer.js'
import { MemoryStore } from './memoryStore.js'
import { seededGame } from './seededGame.js'

const server = await startGameServer({ store: new MemoryStore(seededGame()), port: 4000 })
console.log(`GraphQL server ready on ${server.httpUrl}`)
