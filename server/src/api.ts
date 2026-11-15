import type { Randomizer } from '@domain/utils/random_utils.js'
import type { ServerResponse } from './response.js'
import {
  ServerModel,
  type ActiveGame,
  type Game,
  type GameStore,
  type LobbyResponse,
  type PendingGame,
  type PendingStoreResponse,
  type PlayMove,
  type MoveResponse,
  type StoreResponse,
} from './serverModel.js'

export interface Broadcaster {
  broadcastGame(game: ActiveGame): Promise<void>
  broadcastPendingGames(games: readonly PendingGame[]): Promise<void>
}

export class GameApi {
  private readonly model: ServerModel
  private readonly broadcaster: Broadcaster

  constructor(
    broadcaster: Broadcaster,
    store: GameStore,
    randomizer: Randomizer,
    newId?: () => string,
  ) {
    this.model = new ServerModel(store, randomizer, newId)
    this.broadcaster = broadcaster
  }

  findGame(id: string): Promise<StoreResponse> {
    return this.model.findGame(id)
  }

  async startGame(id: string, players: readonly string[]): Promise<StoreResponse> {
    const response = await this.model.startGame(id, players)
    return this.broadcastOnSuccess(response)
  }

  findPendingGame(id: string): Promise<PendingStoreResponse> {
    return this.model.findPendingGame(id)
  }

  pendingGames(): Promise<readonly PendingGame[]> {
    return this.model.pendingGames()
  }

  async createGame(creator: string, numberOfPlayers: number): Promise<LobbyResponse<PendingGame>> {
    const response = await this.model.createGame(creator, numberOfPlayers)
    return this.broadcastLobbyOnSuccess(response)
  }

  async joinGame(id: string, playerName: string): Promise<LobbyResponse<Game>> {
    const response = await this.model.joinGame(id, playerName)
    await response.process(async (game) => {
      if (!game.pending) await this.broadcaster.broadcastGame(game)
    })
    return this.broadcastLobbyOnSuccess(response)
  }

  async leaveGame(id: string, playerName: string): Promise<LobbyResponse<string>> {
    const response = await this.model.leaveGame(id, playerName)
    return this.broadcastLobbyOnSuccess(response)
  }

  async startPendingGame(id: string, playerName: string): Promise<MoveResponse> {
    const response = await this.model.startPendingGame(id, playerName)
    await this.broadcastOnSuccess(response)
    return this.broadcastLobbyOnSuccess(response)
  }

  async playCard(id: string, playerName: string, move: PlayMove): Promise<MoveResponse> {
    const response = await this.model.playCard(id, playerName, move)
    return this.broadcastOnSuccess(response)
  }

  async drawCard(id: string, playerName: string): Promise<MoveResponse> {
    const response = await this.model.drawCard(id, playerName)
    return this.broadcastOnSuccess(response)
  }

  async sayUno(id: string, playerName: string): Promise<MoveResponse> {
    const response = await this.model.sayUno(id, playerName)
    return this.broadcastOnSuccess(response)
  }

  async catchUnoFailure(id: string, playerName: string, accused: number): Promise<MoveResponse> {
    const response = await this.model.catchUnoFailure(id, playerName, accused)
    return this.broadcastOnSuccess(response)
  }

  private async broadcastOnSuccess<Failure>(
    response: ServerResponse<ActiveGame, Failure>,
  ): Promise<ServerResponse<ActiveGame, Failure>> {
    await response.process((game) => this.broadcaster.broadcastGame(game))
    return response
  }

  private async broadcastLobbyOnSuccess<Value, Failure>(
    response: ServerResponse<Value, Failure>,
  ): Promise<ServerResponse<Value, Failure>> {
    await response.process(async () =>
      this.broadcaster.broadcastPendingGames(await this.model.pendingGames()),
    )
    return response
  }
}
