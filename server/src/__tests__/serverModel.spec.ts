import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStore } from '../memoryStore.js'
import type { ServerResponse } from '../response.js'
import { seededGame } from '../seededGame.js'
import { ServerModel, type ActiveGame, type ServerError } from '../serverModel.js'

const alwaysFirstSeat = () => 0

let game: ActiveGame
let model: ServerModel

beforeEach(() => {
  game = seededGame()
  model = new ServerModel(new MemoryStore(game), alwaysFirstSeat)
})

function errorOf(
  response: ServerResponse<ActiveGame, ServerError>,
): Promise<ServerError | undefined> {
  return response.resolve({ onSuccess: async () => undefined, onError: async (error) => error })
}

const noColour = { color: undefined, sayUno: false }

describe('ServerModel', () => {
  it('lets the player in turn play a card', async () => {
    expect(
      await errorOf(await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })),
    ).toBeUndefined()
    expect(game.round.playerHand(0)).toHaveLength(1)
    expect(game.round.playerInTurn()).toBe(1)
  })

  it('forbids playing out of turn and leaves the game unchanged', async () => {
    expect(await errorOf(await model.playCard('0', 'Bob', { cardIndex: 0, ...noColour }))).toEqual({
      type: 'Forbidden',
    })
    expect(game.round.playerHand(1)).toHaveLength(3)
    expect(game.round.playerInTurn()).toBe(0)
  })

  it('forbids players who are not in the game', async () => {
    expect(await errorOf(await model.playCard('0', 'Eve', { cardIndex: 0, ...noColour }))).toEqual({
      type: 'Forbidden',
    })
    expect(await errorOf(await model.sayUno('0', 'Eve'))).toEqual({ type: 'Forbidden' })
  })

  it('reports an illegal move with the reason and leaves the game unchanged', async () => {
    expect(
      await errorOf(await model.playCard('0', 'Alice', { cardIndex: 1, ...noColour })),
    ).toEqual({
      type: 'Illegal Move',
      reason: 'A wild card needs a colour',
    })
    expect(game.round.playerHand(0)).toHaveLength(2)
  })

  it('reports an unknown game', async () => {
    expect(await errorOf(await model.drawCard('nope', 'Alice'))).toEqual({
      type: 'Not Found',
      key: 'nope',
    })
  })

  it('lets the player in turn draw', async () => {
    await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })
    expect(await errorOf(await model.drawCard('0', 'Bob'))).toBeUndefined()
    expect(game.round.playerHand(1)).toHaveLength(4)
    expect(game.round.playerInTurn()).toBe(0)
  })

  it('lets any player say UNO, even out of turn', async () => {
    expect(await errorOf(await model.sayUno('0', 'Bob'))).toBeUndefined()
  })

  it('lets any player accuse, and a caught player draws four', async () => {
    await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })
    expect(await errorOf(await model.catchUnoFailure('0', 'Bob', 0))).toBeUndefined()
    expect(game.round.playerHand(0)).toHaveLength(5)
  })

  it('says UNO together with the play when asked to', async () => {
    await model.playCard('0', 'Alice', { cardIndex: 0, color: undefined, sayUno: true })
    await model.catchUnoFailure('0', 'Bob', 0)
    expect(game.round.playerHand(0)).toHaveLength(1)
  })

  it('forbids play and draw once the round has ended', async () => {
    await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })
    await model.drawCard('0', 'Bob')
    await model.playCard('0', 'Alice', { cardIndex: 0, color: 'BLUE', sayUno: false })
    expect(game.round.winner()).toBe(0)

    expect(await errorOf(await model.drawCard('0', 'Bob'))).toEqual({ type: 'Forbidden' })
    expect(
      await errorOf(await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })),
    ).toEqual({
      type: 'Forbidden',
    })
  })

  it('forbids saying UNO and catching an UNO failure once the round has ended', async () => {
    await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })
    await model.drawCard('0', 'Bob')
    await model.playCard('0', 'Alice', { cardIndex: 0, color: 'BLUE', sayUno: false })

    expect(await errorOf(await model.sayUno('0', 'Bob'))).toEqual({ type: 'Forbidden' })
    expect(await errorOf(await model.catchUnoFailure('0', 'Bob', 0))).toEqual({ type: 'Forbidden' })
  })

  it('does not keep the UNO call of an illegal play', async () => {
    await model.playCard('0', 'Alice', { cardIndex: 1, color: undefined, sayUno: true })
    await model.playCard('0', 'Alice', { cardIndex: 0, ...noColour })
    await model.catchUnoFailure('0', 'Bob', 0)
    expect(game.round.playerHand(0)).toHaveLength(5)
  })

  it('starts a game with the given players', async () => {
    await model.startGame('7', ['Ann', 'Ben', 'Cid'])
    const started = await (
      await model.findGame('7')
    ).resolve({
      onSuccess: async (found) => found,
      onError: async () => undefined,
    })
    expect(started?.round.playerCount).toBe(3)
    expect(started?.round.player(2)).toBe('Cid')
    expect(started?.round.dealer).toBe(0)
  })
})
