import type { GameServer, OnlineGame, PendingGame } from '../../api/gameServer'

export type FakeGameServer = GameServer & {
  pushPendingGames(games: PendingGame[]): void
  pushGame(game: OnlineGame): void
  calls: string[]
  closed: boolean
}

export function pendingGame(overrides: Partial<PendingGame> = {}): PendingGame {
  return {
    id: 'g1',
    pending: true,
    creator: 'Ann',
    players: ['Ann'],
    numberOfPlayers: 2,
    ...overrides,
  }
}

export function onlineGame(overrides: Partial<OnlineGame> = {}): OnlineGame {
  return {
    id: 'g1',
    pending: false,
    players: ['Ann', 'Ben'],
    playerInTurn: 0,
    hand: [{ type: 'NUMBERED', color: 'RED', number: 5 }, { type: 'WILD' }],
    handSizes: [2, 7],
    topCard: { type: 'NUMBERED', color: 'RED', number: 3 },
    currentColor: 'RED',
    direction: 'clockwise',
    drawPileSize: 80,
    winner: null,
    score: null,
    ...overrides,
  }
}

const unused = () => Promise.reject(new Error('not faked'))

// A server whose answers each test sets up by overriding the methods it needs.
export function fakeGameServer(overrides: Partial<GameServer> = {}): FakeGameServer {
  const pendingListeners = new Set<(games: PendingGame[]) => void>()
  const gameListeners = new Set<(game: OnlineGame) => void>()
  const fake: FakeGameServer = {
    calls: [],
    closed: false,
    pendingGames: async () => [],
    game: async () => null,
    createGame: unused,
    joinGame: unused,
    leaveGame: async () => {},
    startGame: unused,
    playCard: unused,
    drawCard: unused,
    sayUno: unused,
    catchUnoFailure: unused,
    onPendingGames(listener) {
      pendingListeners.add(listener)
      return () => pendingListeners.delete(listener)
    },
    onGameUpdated(listener) {
      gameListeners.add(listener)
      return () => gameListeners.delete(listener)
    },
    close() {
      fake.closed = true
    },
    pushPendingGames: (games) => pendingListeners.forEach((listener) => listener(games)),
    pushGame: (game) => gameListeners.forEach((listener) => listener(game)),
    ...overrides,
  }
  return fake
}
