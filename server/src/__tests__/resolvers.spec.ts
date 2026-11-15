import { ApolloServer } from '@apollo/server'
import { PubSub } from 'graphql-subscriptions'
import { beforeEach, describe, expect, it } from 'vitest'
import { GameApi } from '../api.js'
import type { GameContext } from '../context.js'
import { MemoryStore } from '../memoryStore.js'
import { createGameSchema } from '../schema.js'
import { seededGame } from '../seededGame.js'

let server: ApolloServer<GameContext>

beforeEach(async () => {
  let nextId = 1
  const api = new GameApi(
    { async broadcastGame() {}, async broadcastPendingGames() {} },
    new MemoryStore(seededGame()),
    () => 0,
    () => `g${nextId++}`,
  )
  server = new ApolloServer<GameContext>({ schema: await createGameSchema(new PubSub(), api) })
})

async function executeAs(playerName: string | undefined, query: string) {
  const response = await server.executeOperation({ query }, { contextValue: { playerName } })
  if (response.body.kind !== 'single') throw new Error('expected a single result')
  return response.body.singleResult
}

const gameQuery = '{ game(id: "0") { players handSizes hand { type color number } } }'

describe('resolvers', () => {
  it('shows the caller only their own hand', async () => {
    const asAlice = await executeAs('Alice', gameQuery)
    expect(asAlice.errors).toBeUndefined()
    expect(asAlice.data?.game).toEqual({
      players: ['Alice', 'Bob'],
      handSizes: [2, 3],
      hand: [
        { type: 'NUMBERED', color: 'RED', number: 5 },
        { type: 'WILD', color: null, number: null },
      ],
    })

    const asBob = await executeAs('Bob', gameQuery)
    expect((asBob.data?.game as { hand: unknown[] }).hand).toHaveLength(3)
  })

  it('hides every hand from strangers and anonymous callers', async () => {
    expect((await executeAs('Eve', gameQuery)).data?.game).toMatchObject({ hand: null })
    expect((await executeAs(undefined, gameQuery)).data?.game).toMatchObject({ hand: null })
  })

  it('returns null for an unknown game', async () => {
    const result = await executeAs('Alice', '{ game(id: "nope") { id } }')
    expect(result.errors).toBeUndefined()
    expect(result.data?.game).toBeNull()
  })

  it('plays a card for the caller', async () => {
    const result = await executeAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: 0, sayUno: false) { handSizes playerInTurn } }',
    )
    expect(result.errors).toBeUndefined()
    expect(result.data?.playCard).toEqual({ handSizes: [1, 3], playerInTurn: 1 })
  })

  it('accepts a null colour for a number card', async () => {
    const result = await executeAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: 0, color: null, sayUno: false) { handSizes } }',
    )
    expect(result.errors).toBeUndefined()
  })

  it('plays a wild card with the chosen colour', async () => {
    const result = await executeAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: 1, color: "BLUE", sayUno: false) { currentColor } }',
    )
    expect(result.data?.playCard).toEqual({ currentColor: 'BLUE' })
  })

  it('rejects a colour that is not a card colour', async () => {
    const result = await executeAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: 1, color: "PURPLE", sayUno: false) { id } }',
    )
    expect(result.errors?.[0]?.extensions?.code).toBe('Bad Request')
  })

  it('rejects a negative card index', async () => {
    const result = await executeAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: -1, sayUno: false) { id } }',
    )
    expect(result.errors?.[0]?.extensions?.code).toBe('Bad Request')
  })

  it('forbids anonymous callers', async () => {
    const result = await executeAs(undefined, 'mutation { drawCard(id: "0") { id } }')
    expect(result.errors?.[0]?.extensions?.code).toBe('Forbidden')
  })

  it('reports out-of-turn moves as Forbidden', async () => {
    const result = await executeAs('Bob', 'mutation { drawCard(id: "0") { id } }')
    expect(result.errors?.[0]?.extensions?.code).toBe('Forbidden')
  })

  it('explains an illegal move', async () => {
    const result = await executeAs(
      'Alice',
      'mutation { playCard(id: "0", cardIndex: 1, sayUno: false) { id } }',
    )
    expect(result.errors?.[0]?.extensions?.code).toBe('Illegal Move')
    expect(result.errors?.[0]?.message).toBe('A wild card needs a colour')
  })

  it('lets a player say UNO and catch an UNO failure', async () => {
    await executeAs('Alice', 'mutation { playCard(id: "0", cardIndex: 0, sayUno: false) { id } }')
    expect((await executeAs('Bob', 'mutation { sayUno(id: "0") { id } }')).errors).toBeUndefined()
    const result = await executeAs(
      'Bob',
      'mutation { catchUnoFailure(id: "0", accused: 0) { handSizes } }',
    )
    expect(result.data?.catchUnoFailure).toEqual({ handSizes: [5, 3] })
  })

  it('creates a game with the caller waiting in it', async () => {
    const result = await executeAs(
      'Ann',
      'mutation { createGame(numberOfPlayers: 3) { id pending creator players numberOfPlayers } }',
    )
    expect(result.errors).toBeUndefined()
    expect(result.data?.createGame).toEqual({
      id: 'g1',
      pending: true,
      creator: 'Ann',
      players: ['Ann'],
      numberOfPlayers: 3,
    })
    const listed = await executeAs(undefined, '{ pendingGames { id players } }')
    expect(listed.data?.pendingGames).toEqual([{ id: 'g1', players: ['Ann'] }])
  })

  it('rejects a game for fewer than 2 or more than 4 players', async () => {
    for (const numberOfPlayers of [1, 5]) {
      const result = await executeAs(
        'Ann',
        `mutation { createGame(numberOfPlayers: ${numberOfPlayers}) { id } }`,
      )
      expect(result.errors?.[0]?.extensions?.code).toBe('Bad Request')
    }
  })

  const joinQuery = `mutation { joinGame(id: "g1") {
    __typename
    ... on PendingGame { players }
    ... on ActiveGame { players hand { type } }
  } }`

  it('returns the pending game while seats are free and the active game once full', async () => {
    await executeAs('Ann', 'mutation { createGame(numberOfPlayers: 3) { id } }')
    const ben = await executeAs('Ben', joinQuery)
    expect(ben.data?.joinGame).toEqual({ __typename: 'PendingGame', players: ['Ann', 'Ben'] })

    const cid = await executeAs('Cid', joinQuery)
    expect(cid.data?.joinGame).toMatchObject({
      __typename: 'ActiveGame',
      players: ['Ann', 'Ben', 'Cid'],
    })
    expect((cid.data?.joinGame as { hand: unknown[] }).hand).toHaveLength(7)
    const pending = await executeAs('Ann', '{ pendingGame(id: "g1") { id } }')
    expect(pending.data?.pendingGame).toBeNull()
    const active = await executeAs('Ann', '{ game(id: "g1") { id } }')
    expect(active.data?.game).toEqual({ id: 'g1' })
  })

  it('reports joining twice as a Conflict', async () => {
    await executeAs('Ann', 'mutation { createGame(numberOfPlayers: 3) { id } }')
    const result = await executeAs('Ann', joinQuery)
    expect(result.errors?.[0]?.extensions?.code).toBe('Conflict')
    expect(result.errors?.[0]?.message).toBe('Ann is already waiting for game g1')
  })

  it('lets only the creator start a game early', async () => {
    await executeAs('Ann', 'mutation { createGame(numberOfPlayers: 4) { id } }')
    await executeAs('Ben', joinQuery)
    const byBen = await executeAs('Ben', 'mutation { startGame(id: "g1") { id } }')
    expect(byBen.errors?.[0]?.extensions?.code).toBe('Forbidden')

    const byAnn = await executeAs('Ann', 'mutation { startGame(id: "g1") { players } }')
    expect(byAnn.data?.startGame).toEqual({ players: ['Ann', 'Ben'] })
  })

  it('lets a waiting player leave', async () => {
    await executeAs('Ann', 'mutation { createGame(numberOfPlayers: 3) { id } }')
    const result = await executeAs('Ann', 'mutation { leaveGame(id: "g1") }')
    expect(result.data?.leaveGame).toBe('g1')
    expect((await executeAs('Ann', '{ pendingGames { id } }')).data?.pendingGames).toEqual([])
  })

  it('forbids anonymous callers from creating games', async () => {
    const result = await executeAs(undefined, 'mutation { createGame(numberOfPlayers: 2) { id } }')
    expect(result.errors?.[0]?.extensions?.code).toBe('Forbidden')
  })
})
