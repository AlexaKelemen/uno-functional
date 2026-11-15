import { beforeEach, describe, expect, it } from 'vitest'
import { GameApi, type Broadcaster } from '../api.js'
import { MemoryStore } from '../memoryStore.js'
import { seededGame } from '../seededGame.js'
import type { ActiveGame, PendingGame } from '../serverModel.js'

let broadcastGames: ActiveGame[]
let broadcastLobbies: (readonly PendingGame[])[]
let api: GameApi

beforeEach(() => {
  broadcastGames = []
  broadcastLobbies = []
  const broadcaster: Broadcaster = {
    async broadcastGame(game) {
      broadcastGames.push(game)
    },
    async broadcastPendingGames(games) {
      broadcastLobbies.push(games)
    },
  }
  let nextId = 1
  api = new GameApi(
    broadcaster,
    new MemoryStore(seededGame()),
    () => 0,
    () => `g${nextId++}`,
  )
})

const noColour = { color: undefined, sayUno: false }

describe('createApi', () => {
  it('broadcasts the game after a successful move', async () => {
    await api.playCard('0', 'Alice', { cardIndex: 0, ...noColour })
    expect(broadcastGames.map((game) => game.id)).toEqual(['0'])
  })

  it('does not broadcast a forbidden move', async () => {
    await api.playCard('0', 'Bob', { cardIndex: 0, ...noColour })
    expect(broadcastGames).toEqual([])
  })

  it('does not broadcast an illegal move', async () => {
    await api.playCard('0', 'Alice', { cardIndex: 1, ...noColour })
    expect(broadcastGames).toEqual([])
  })

  it('broadcasts a started game', async () => {
    await api.startGame('7', ['Ann', 'Ben'])
    expect(broadcastGames.map((game) => game.id)).toEqual(['7'])
  })

  it('does not broadcast a lookup', async () => {
    await api.findGame('0')
    expect(broadcastGames).toEqual([])
  })

  it('broadcasts the lobby when a game is created, joined or left', async () => {
    await api.createGame('Ann', 3)
    await api.joinGame('g1', 'Ben')
    await api.leaveGame('g1', 'Ann')
    expect(broadcastLobbies.map((games) => games.map((game) => game.players))).toEqual([
      [['Ann']],
      [['Ann', 'Ben']],
      [['Ben']],
    ])
    expect(broadcastGames).toEqual([])
  })

  it('broadcasts the started game and the lobby without it when the last seat fills', async () => {
    await api.createGame('Ann', 2)
    await api.joinGame('g1', 'Ben')
    expect(broadcastGames.map((game) => game.id)).toEqual(['g1'])
    expect(broadcastLobbies.at(-1)).toEqual([])
  })

  it('broadcasts a game the creator starts early', async () => {
    await api.createGame('Ann', 4)
    await api.joinGame('g1', 'Ben')
    await api.startPendingGame('g1', 'Ann')
    expect(broadcastGames.map((game) => game.round.playerCount)).toEqual([2])
    expect(broadcastLobbies.at(-1)).toEqual([])
  })

  it('does not broadcast a refused lobby action', async () => {
    await api.joinGame('nope', 'Ann')
    await api.leaveGame('nope', 'Ann')
    expect(broadcastLobbies).toEqual([])
  })
})
