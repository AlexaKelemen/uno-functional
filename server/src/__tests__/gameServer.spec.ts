import { createClient, type Client } from 'graphql-ws'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { startGameServer, type RunningGameServer } from '../gameServer.js'
import { MemoryStore } from '../memoryStore.js'
import { seededGame } from '../seededGame.js'

type GameUpdatedEvent = { gameUpdated: { hand: unknown[] | null; handSizes: number[] } }

type Subscription = { readonly firstEvent: Promise<GameUpdatedEvent | undefined> }

let server: RunningGameServer
const clients: Client[] = []

beforeEach(async () => {
  server = await startGameServer({ store: new MemoryStore(seededGame()), port: 0 })
})

afterEach(async () => {
  clients.splice(0).forEach((client) => client.dispose())
  await server.stop()
})

async function subscribeAs(playerName: string): Promise<Subscription> {
  let markConnected!: () => void
  const connected = new Promise<void>((resolve) => (markConnected = resolve))
  const client = createClient({
    url: server.webSocketUrl,
    webSocketImpl: WebSocket,
    connectionParams: { playerName },
    retryAttempts: 0,
    on: { connected: () => markConnected() },
  })
  clients.push(client)
  const events = client.iterate<GameUpdatedEvent>({
    query: 'subscription { gameUpdated { hand { type } handSizes } }',
  })
  const firstEvent = events.next().then((result) => result.value?.data ?? undefined)
  await connected
  return { firstEvent }
}

function postAs(playerName: string | undefined, query: string) {
  return fetch(server.httpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(playerName === undefined ? {} : { 'player-name': playerName }),
    },
    body: JSON.stringify({ query }),
  })
}

const nothingWithin = (milliseconds: number) =>
  new Promise<'nothing'>((resolve) => setTimeout(() => resolve('nothing'), milliseconds))

describe('game server', () => {
  it("sends events only to the game's players, each with only their own hand", async () => {
    const { firstEvent: aliceEvent } = await subscribeAs('Alice')
    const { firstEvent: bobEvent } = await subscribeAs('Bob')
    const { firstEvent: eveEvent } = await subscribeAs('Eve')
    await new Promise((resolve) => setTimeout(resolve, 50))

    const response = await postAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: 0, sayUno: false) { id } }',
    )
    expect((await response.json()).errors).toBeUndefined()

    expect(await aliceEvent).toEqual({
      gameUpdated: { hand: [{ type: 'WILD' }], handSizes: [1, 3] },
    })
    const bob = await bobEvent
    expect(bob?.gameUpdated.hand).toHaveLength(3)
    expect(bob?.gameUpdated.handSizes).toEqual([1, 3])
    expect(await Promise.race([eveEvent, nothingWithin(300)])).toBe('nothing')
  })

  it('sends the lobby to every subscriber when a game is created', async () => {
    const client = createClient({ url: server.webSocketUrl, webSocketImpl: WebSocket })
    clients.push(client)
    const events = client.iterate<{ pendingGamesUpdated: { creator: string }[] }>({
      query: 'subscription { pendingGamesUpdated { creator } }',
    })
    const firstEvent = events.next()
    await new Promise((resolve) => setTimeout(resolve, 50))

    await postAs('Ann', 'mutation { createGame(numberOfPlayers: 2) { id } }')

    expect((await firstEvent).value?.data).toEqual({ pendingGamesUpdated: [{ creator: 'Ann' }] })
  })

  it('identifies HTTP callers by the player-name header', async () => {
    const anonymous = await postAs(undefined, 'mutation { drawCard(id: "0") { id } }')
    expect((await anonymous.json()).errors[0].extensions.code).toBe('Forbidden')

    const alice = await postAs('Alice', '{ game(id: "0") { hand { type } } }')
    expect((await alice.json()).data.game.hand).toHaveLength(2)
  })

  it('allows the Vite dev client to call it', async () => {
    const preflight = await fetch(server.httpUrl, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,player-name',
      },
    })
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })
})
