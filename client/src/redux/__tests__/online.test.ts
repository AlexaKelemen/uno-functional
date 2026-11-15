import { describe, expect, it } from 'vitest'
import { createConnection } from '../../api/connection'
import { makeStore } from '../store'
import { login, logout } from '../thunks/session'
import { createGame, joinGame, leaveGame, receivePendingGames } from '../thunks/lobby'
import { accuseOnline, playOnline } from '../thunks/onlineGame'
import { gameReceived } from '../slices/onlineGamesSlice'
import { selectOnlineView, selectStartedGameId, selectWaitingIn } from '../selectors'
import { fakeGameServer, onlineGame, pendingGame, type FakeGameServer } from './fakeGameServer'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function loggedInStore(name: string, server: FakeGameServer) {
  const store = makeStore(createConnection(() => server))
  store.dispatch(login(name))
  await flush()
  return store
}

describe('session', () => {
  it('logs in with a trimmed name and loads the open games', async () => {
    const store = await loggedInStore('  Ann ', fakeGameServer({ pendingGames: async () => [pendingGame()] }))
    expect(store.getState().session.playerName).toBe('Ann')
    expect(store.getState().lobby.pendingGames.map((g) => g.id)).toEqual(['g1'])
  })

  it('ignores a blank name', async () => {
    const store = await loggedInStore('   ', fakeGameServer())
    expect(store.getState().session.playerName).toBeUndefined()
  })

  it('closes the connection and clears the state on logout', async () => {
    const server = fakeGameServer({ pendingGames: async () => [pendingGame()] })
    const store = await loggedInStore('Ann', server)
    store.dispatch(gameReceived(onlineGame()))
    store.dispatch(logout())
    expect(server.closed).toBe(true)
    expect(store.getState().session.playerName).toBeUndefined()
    expect(store.getState().lobby.pendingGames).toEqual([])
    expect(store.getState().onlineGames.games).toEqual({})
  })
})

describe('server pushes', () => {
  it('shows lobby changes pushed by the server', async () => {
    const server = fakeGameServer()
    const store = await loggedInStore('Ann', server)
    server.pushPendingGames([pendingGame()])
    await flush()
    expect(store.getState().lobby.pendingGames.map((g) => g.id)).toEqual(['g1'])
  })

  it("shows opponents' moves pushed by the server", async () => {
    const server = fakeGameServer()
    const store = await loggedInStore('Ann', server)
    server.pushGame(onlineGame({ playerInTurn: 1 }))
    expect(store.getState().onlineGames.games.g1?.playerInTurn).toBe(1)
  })

  it('stops listening after logout', async () => {
    const server = fakeGameServer()
    const store = await loggedInStore('Ann', server)
    store.dispatch(logout())
    server.pushGame(onlineGame())
    expect(store.getState().onlineGames.games).toEqual({})
  })

  it('listens only once after logging in again', async () => {
    const server = fakeGameServer()
    const store = await loggedInStore('Ann', server)
    store.dispatch(login('Ann'))
    let updates = 0
    store.subscribe(() => updates++)
    server.pushGame(onlineGame())
    expect(updates).toBe(1)
  })
})

describe('lobby', () => {
  it('waits in a game it created', async () => {
    const server = fakeGameServer({ createGame: async () => pendingGame({ numberOfPlayers: 3 }) })
    const store = await loggedInStore('Ann', server)
    await store.dispatch(createGame(3))
    await store.dispatch(receivePendingGames([pendingGame({ numberOfPlayers: 3 })]))
    expect(selectWaitingIn(store.getState())?.numberOfPlayers).toBe(3)
  })

  it('notices that the game it waits in has started', async () => {
    const server = fakeGameServer({
      joinGame: async () => pendingGame({ players: ['Ann', 'Cid'] }),
      game: async () => onlineGame(),
    })
    const store = await loggedInStore('Cid', server)
    await store.dispatch(joinGame('g1'))
    expect(selectStartedGameId(store.getState())).toBeUndefined()

    await store.dispatch(receivePendingGames([])) // g1 left the list
    expect(selectStartedGameId(store.getState())).toBe('g1')
  })

  it('stops waiting when the game it waits in disappears', async () => {
    const server = fakeGameServer({ joinGame: async () => pendingGame(), game: async () => null })
    const store = await loggedInStore('Cid', server)
    await store.dispatch(joinGame('g1'))
    await store.dispatch(receivePendingGames([]))
    expect(store.getState().lobby.waitingForId).toBeUndefined()
  })

  it('goes straight to the game when joining fills it', async () => {
    const store = await loggedInStore('Ben', fakeGameServer({ joinGame: async () => onlineGame() }))
    await store.dispatch(joinGame('g1'))
    expect(selectStartedGameId(store.getState())).toBe('g1')
  })

  it('leaves a game', async () => {
    const store = await loggedInStore('Ann', fakeGameServer({ createGame: async () => pendingGame() }))
    await store.dispatch(createGame(2))
    await store.dispatch(leaveGame())
    expect(store.getState().lobby.waitingForId).toBeUndefined()
  })

  it('shows the server error', async () => {
    const store = await loggedInStore('Ann', fakeGameServer())
    await store.dispatch(createGame(2)) // not faked: rejects
    expect(store.getState().lobby.error).toBe('not faked')
  })
})

describe('online game', () => {
  it('keeps the game the server answers with', async () => {
    const server = fakeGameServer({ playCard: async () => onlineGame({ playerInTurn: 1 }) })
    const store = await loggedInStore('Ann', server)
    await store.dispatch(playOnline('g1', 0, undefined, false))
    expect(store.getState().onlineGames.games.g1?.playerInTurn).toBe(1)
  })

  it('shows the error when the server refuses a move', async () => {
    const server = fakeGameServer({ playCard: async () => Promise.reject(new Error('Illegal play')) })
    const store = await loggedInStore('Ann', server)
    await store.dispatch(playOnline('g1', 0, undefined, false))
    expect(store.getState().onlineGames.error).toBe('Illegal play')
  })

  it('tells whether an accusation caught someone', async () => {
    const server = fakeGameServer({ catchUnoFailure: async () => onlineGame({ handSizes: [2, 5] }) })
    const store = await loggedInStore('Ann', server)
    store.dispatch(gameReceived(onlineGame({ handSizes: [2, 1] })))
    expect(await store.dispatch(accuseOnline('g1', 1))).toBe(true)
  })

  it('shows the game from my seat', async () => {
    const store = await loggedInStore('Ben', fakeGameServer())
    store.dispatch(gameReceived(onlineGame()))
    const view = selectOnlineView(store.getState(), 'g1')!
    expect(view.playerIndex).toBe(1)
    expect(view.playerNames).toEqual(['Ann', 'Ben'])
    expect(selectOnlineView(store.getState(), 'g1')).toBe(view)
  })
})
