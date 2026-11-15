import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStore } from '../memoryStore.js'
import { ServerResponse as Response, type ServerResponse } from '../response.js'
import {
  ServerModel,
  type ActiveGame,
  type ServerError,
  type StoreResponse,
} from '../serverModel.js'

let model: ServerModel

beforeEach(() => {
  let nextId = 1
  model = new ServerModel(
    new MemoryStore(),
    () => 0,
    () => `g${nextId++}`,
  )
})

function valueOf<Value>(response: ServerResponse<Value, ServerError>): Promise<Value | undefined> {
  return response.resolve({ onSuccess: async (value) => value, onError: async () => undefined })
}

function errorOf<Value>(
  response: ServerResponse<Value, ServerError>,
): Promise<ServerError | undefined> {
  return response.resolve({ onSuccess: async () => undefined, onError: async (error) => error })
}

async function playersWaiting(id: string) {
  return (await valueOf(await model.findPendingGame(id)))?.players
}

describe('lobby', () => {
  it('creates a pending game with the creator in the first seat', async () => {
    expect(await valueOf(await model.createGame('Ann', 3))).toEqual({
      id: 'g1',
      pending: true,
      creator: 'Ann',
      players: ['Ann'],
      numberOfPlayers: 3,
    })
    expect(await model.pendingGames()).toHaveLength(1)
  })

  it('seats joining players in the order they join', async () => {
    await model.createGame('Ann', 4)
    await model.joinGame('g1', 'Ben')
    await model.joinGame('g1', 'Cid')
    expect(await playersWaiting('g1')).toEqual(['Ann', 'Ben', 'Cid'])
  })

  it('starts the game when the last seat is taken', async () => {
    await model.createGame('Ann', 2)
    const joined = await valueOf(await model.joinGame('g1', 'Ben'))
    expect(joined?.pending).toBe(false)
    expect(await model.pendingGames()).toEqual([])
    const started = await valueOf(await model.findGame('g1'))
    expect(started?.round.player(1)).toBe('Ben')
  })

  it('reports joining an unknown game', async () => {
    expect(await errorOf(await model.joinGame('nope', 'Ann'))).toEqual({
      type: 'Not Found',
      key: 'nope',
    })
  })

  it('keeps a player from waiting in two games at once', async () => {
    await model.createGame('Ann', 3)
    await model.createGame('Ben', 3)
    expect(await errorOf(await model.joinGame('g1', 'Ann'))).toMatchObject({ type: 'Conflict' })
    expect(await errorOf(await model.joinGame('g2', 'Ann'))).toMatchObject({ type: 'Conflict' })
    expect(await errorOf(await model.createGame('Ann', 2))).toMatchObject({ type: 'Conflict' })
    expect(await model.pendingGames()).toHaveLength(2)
  })

  it('lets a player wait for a new game after their last one started', async () => {
    await model.createGame('Ann', 2)
    await model.joinGame('g1', 'Ben')
    expect(await errorOf(await model.createGame('Ann', 2))).toBeUndefined()
  })

  it('removes a leaving player and hands the game to the next player', async () => {
    await model.createGame('Ann', 4)
    await model.joinGame('g1', 'Ben')
    await model.joinGame('g1', 'Cid')
    await model.leaveGame('g1', 'Ann')
    expect(await valueOf(await model.findPendingGame('g1'))).toMatchObject({
      creator: 'Ben',
      players: ['Ben', 'Cid'],
    })
  })

  it('removes the game when the last player leaves', async () => {
    await model.createGame('Ann', 3)
    expect(await valueOf(await model.leaveGame('g1', 'Ann'))).toBe('g1')
    expect(await model.pendingGames()).toEqual([])
  })

  it('forbids leaving a game one is not waiting in', async () => {
    await model.createGame('Ann', 3)
    expect(await errorOf(await model.leaveGame('g1', 'Ben'))).toEqual({ type: 'Forbidden' })
  })

  it('lets only the creator start early, and only with at least two players', async () => {
    await model.createGame('Ann', 4)
    expect(await errorOf(await model.startPendingGame('g1', 'Ann'))).toEqual({
      type: 'Conflict',
      reason: 'A game needs at least 2 players',
    })
    await model.joinGame('g1', 'Ben')
    expect(await errorOf(await model.startPendingGame('g1', 'Ben'))).toEqual({ type: 'Forbidden' })

    const started = await valueOf(await model.startPendingGame('g1', 'Ann'))
    expect(started?.round.playerCount).toBe(2)
    expect(await model.pendingGames()).toEqual([])
  })
})

describe('starting a game that fails', () => {
  function modelWith(store: MemoryStore, randomizer: () => number) {
    let nextId = 1
    return new ServerModel(store, randomizer, () => `g${nextId++}`)
  }

  it('keeps the players waiting when the round cannot be dealt', async () => {
    const failingDealer = () => {
      throw new Error('no dealer')
    }
    const failing = modelWith(new MemoryStore(), failingDealer)
    await failing.createGame('Ann', 2)

    expect(await errorOf(await failing.joinGame('g1', 'Ben'))).toEqual({
      type: 'Conflict',
      reason: 'Could not start the game: no dealer',
    })
    // Ben's join failed, so he isn't seated - but Ann is still waiting instead of being lost
    expect((await valueOf(await failing.findPendingGame('g1')))?.players).toEqual(['Ann'])
    expect(await errorOf(await failing.findGame('g1'))).toMatchObject({ type: 'Not Found' })
  })

  it('keeps the players waiting when the game cannot be saved', async () => {
    class BrokenStore extends MemoryStore {
      override async addGame(game: ActiveGame): Promise<StoreResponse> {
        return Response.failure({ type: 'Not Found', key: game.id })
      }
    }
    const failing = modelWith(new BrokenStore(), () => 0)
    await failing.createGame('Ann', 3)
    await failing.joinGame('g1', 'Ben')

    expect(await errorOf(await failing.startPendingGame('g1', 'Ann'))).toMatchObject({
      type: 'Not Found',
    })
    expect((await valueOf(await failing.findPendingGame('g1')))?.players).toEqual(['Ann', 'Ben'])
  })
})
