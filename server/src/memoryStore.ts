import { ServerResponse } from './response.js'
import type {
  ActiveGame,
  GameStore,
  PendingGame,
  PendingStoreResponse,
  StoreError,
  StoreResponse,
} from './serverModel.js'

const notFound = (key: string): StoreError => ({ type: 'Not Found', key })

export class MemoryStore implements GameStore {
  private readonly games: Map<string, ActiveGame>
  private readonly pending = new Map<string, PendingGame>()

  constructor(...games: ActiveGame[]) {
    this.games = new Map(games.map((game) => [game.id, game]))
  }

  async findGame(id: string): Promise<StoreResponse> {
    const game = this.games.get(id)
    return game === undefined ? ServerResponse.failure(notFound(id)) : ServerResponse.success(game)
  }

  async addGame(game: ActiveGame): Promise<StoreResponse> {
    this.games.set(game.id, game)
    return ServerResponse.success(game)
  }

  async updateGame(game: ActiveGame): Promise<StoreResponse> {
    if (!this.games.has(game.id)) return ServerResponse.failure(notFound(game.id))
    this.games.set(game.id, game)
    return ServerResponse.success(game)
  }

  async findPendingGame(id: string): Promise<PendingStoreResponse> {
    const game = this.pending.get(id)
    return game === undefined ? ServerResponse.failure(notFound(id)) : ServerResponse.success(game)
  }

  async pendingGames(): Promise<readonly PendingGame[]> {
    return [...this.pending.values()]
  }

  async savePendingGame(game: PendingGame): Promise<PendingStoreResponse> {
    this.pending.set(game.id, game)
    return ServerResponse.success(game)
  }

  async removePendingGame(id: string): Promise<void> {
    this.pending.delete(id)
  }
}
