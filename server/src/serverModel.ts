import type { CardColor } from '@domain/model/card.js'
import { UnoRound, type Round } from '@domain/model/round.js'
import type { Randomizer } from '@domain/utils/random_utils.js'
import { randomUUID } from 'node:crypto'
import { ServerResponse } from './response.js'

export type ActiveGame = {
  readonly id: string
  readonly pending: false
  readonly round: Round
}

export type PendingGame = {
  readonly id: string
  readonly pending: true
  readonly creator: string
  readonly players: readonly string[]
  readonly numberOfPlayers: number
}

export type Game = ActiveGame | PendingGame

export type StoreError = { readonly type: 'Not Found'; readonly key: string }

export type ServerError =
  | StoreError
  | { readonly type: 'Forbidden' }
  | { readonly type: 'Illegal Move'; readonly reason: string }
  | { readonly type: 'Conflict'; readonly reason: string }

export type StoreResponse = ServerResponse<ActiveGame, StoreError>

export type PendingStoreResponse = ServerResponse<PendingGame, StoreError>

export type MoveResponse = ServerResponse<ActiveGame, ServerError>

export type LobbyResponse<Value> = ServerResponse<Value, ServerError>

export interface GameStore {
  findGame(id: string): Promise<StoreResponse>
  addGame(game: ActiveGame): Promise<StoreResponse>
  updateGame(game: ActiveGame): Promise<StoreResponse>
  findPendingGame(id: string): Promise<PendingStoreResponse>
  pendingGames(): Promise<readonly PendingGame[]>
  savePendingGame(game: PendingGame): Promise<PendingStoreResponse>
  removePendingGame(id: string): Promise<void>
}

export const minPlayers = 2

export const maxPlayers = 4

export type PlayMove = {
  readonly cardIndex: number
  readonly color: CardColor | undefined
  readonly sayUno: boolean
}

type WhoMayAct = 'playerInTurn' | 'anyPlayer'

type RoundAction = (round: Round, seat: number) => void

const forbidden: ServerError = { type: 'Forbidden' }

const conflict = (reason: string): ServerError => ({ type: 'Conflict', reason })

function seatOfPlayer(game: ActiveGame, playerName: string): number {
  const players = Array.from({ length: game.round.playerCount }, (_, seat) =>
    game.round.player(seat),
  )
  return players.indexOf(playerName)
}

function isAllowedToAct(game: ActiveGame, playerName: string, whoMayAct: WhoMayAct): boolean {
  const seat = seatOfPlayer(game, playerName)
  if (seat === -1 || game.round.hasEnded()) return false
  return whoMayAct === 'anyPlayer' || game.round.playerInTurn() === seat
}

function applyToRound(game: ActiveGame, seat: number, action: RoundAction): MoveResponse {
  try {
    action(game.round, seat)
    return ServerResponse.success(game)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return ServerResponse.failure<ServerError>({ type: 'Illegal Move', reason })
  }
}

export class ServerModel {
  private readonly store: GameStore
  private readonly randomizer: Randomizer
  private readonly newId: () => string

  constructor(store: GameStore, randomizer: Randomizer, newId: () => string = randomUUID) {
    this.store = store
    this.randomizer = randomizer
    this.newId = newId
  }

  findGame(id: string): Promise<StoreResponse> {
    return this.store.findGame(id)
  }

  startGame(id: string, players: readonly string[]): Promise<StoreResponse> {
    const round = new UnoRound({ players: [...players], dealer: this.randomizer(players.length) })
    return this.store.addGame({ id, pending: false, round })
  }

  findPendingGame(id: string): Promise<PendingStoreResponse> {
    return this.store.findPendingGame(id)
  }

  pendingGames(): Promise<readonly PendingGame[]> {
    return this.store.pendingGames()
  }

  async createGame(creator: string, numberOfPlayers: number): Promise<LobbyResponse<PendingGame>> {
    const waiting = await this.refuseIfWaiting(creator)
    if (waiting !== undefined) return waiting
    return this.store.savePendingGame({
      id: this.newId(),
      pending: true,
      creator,
      players: [creator],
      numberOfPlayers,
    })
  }

  async joinGame(id: string, playerName: string): Promise<LobbyResponse<Game>> {
    const waiting = await this.refuseIfWaiting(playerName)
    if (waiting !== undefined) return waiting
    const found = await this.store.findPendingGame(id)
    return found.flatMap(async (game): Promise<LobbyResponse<Game>> => {
      const joined = { ...game, players: [...game.players, playerName] }
      if (joined.players.length < joined.numberOfPlayers) return this.store.savePendingGame(joined)
      return this.beginPendingGame(joined)
    })
  }

  async leaveGame(id: string, playerName: string): Promise<LobbyResponse<string>> {
    const found = await this.store.findPendingGame(id)
    const member = await found.filter(
      async (game) => game.players.includes(playerName),
      async () => forbidden,
    )
    return member.flatMap(async (game): Promise<LobbyResponse<string>> => {
      const players = game.players.filter((player) => player !== playerName)
      const [nextCreator] = players
      if (nextCreator === undefined) {
        await this.store.removePendingGame(id)
        return ServerResponse.success(id)
      }
      const creator = game.creator === playerName ? nextCreator : game.creator
      const saved = await this.store.savePendingGame({ ...game, creator, players })
      return saved.flatMap(async () => ServerResponse.success(id))
    })
  }

  async startPendingGame(id: string, playerName: string): Promise<MoveResponse> {
    const found = await this.store.findPendingGame(id)
    const byCreator = await found.filter(
      async (game) => game.creator === playerName,
      async () => forbidden,
    )
    const enoughPlayers = await byCreator.filter(
      async (game) => game.players.length >= minPlayers,
      async () => conflict(`A game needs at least ${minPlayers} players`),
    )
    return enoughPlayers.flatMap((game) => this.beginPendingGame(game))
  }

  // Create and store the round first, and only then remove the waiting game.
  // If anything fails the players are still in the waiting game and can try again.
  private async beginPendingGame(game: PendingGame): Promise<MoveResponse> {
    const round = this.dealRound(game.players)
    const added = await round.flatMap((round) =>
      this.store.addGame({ id: game.id, pending: false, round }),
    )
    await added.process(() => this.store.removePendingGame(game.id))
    return added
  }

  private dealRound(players: readonly string[]): ServerResponse<Round, ServerError> {
    try {
      const dealer = this.randomizer(players.length)
      return ServerResponse.success(new UnoRound({ players: [...players], dealer }))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return ServerResponse.failure(conflict(`Could not start the game: ${reason}`))
    }
  }

  private async refuseIfWaiting(playerName: string): Promise<LobbyResponse<never> | undefined> {
    const games = await this.store.pendingGames()
    const waitingIn = games.find((game) => game.players.includes(playerName))
    if (waitingIn === undefined) return undefined
    return ServerResponse.failure(
      conflict(`${playerName} is already waiting for game ${waitingIn.id}`),
    )
  }

  playCard(
    id: string,
    playerName: string,
    { cardIndex, color, sayUno }: PlayMove,
  ): Promise<MoveResponse> {
    return this.applyPlayerAction(id, playerName, 'playerInTurn', (round, seat) => {
      round.play(cardIndex, color)
      if (sayUno && !round.hasEnded()) round.sayUno(seat)
    })
  }

  drawCard(id: string, playerName: string): Promise<MoveResponse> {
    return this.applyPlayerAction(id, playerName, 'playerInTurn', (round) => {
      round.draw()
    })
  }

  sayUno(id: string, playerName: string): Promise<MoveResponse> {
    return this.applyPlayerAction(id, playerName, 'anyPlayer', (round, seat) => {
      round.sayUno(seat)
    })
  }

  catchUnoFailure(id: string, playerName: string, accused: number): Promise<MoveResponse> {
    return this.applyPlayerAction(id, playerName, 'anyPlayer', (round, seat) => {
      round.catchUnoFailure({ accuser: seat, accused })
    })
  }

  private async applyPlayerAction(
    id: string,
    playerName: string,
    whoMayAct: WhoMayAct,
    action: RoundAction,
  ): Promise<MoveResponse> {
    const found = await this.store.findGame(id)
    const allowed = await found.filter(
      async (game) => isAllowedToAct(game, playerName, whoMayAct),
      async () => forbidden,
    )
    const acted = await allowed.flatMap(async (game) =>
      applyToRound(game, seatOfPlayer(game, playerName), action),
    )
    return acted.flatMap((game) => this.store.updateGame(game))
  }
}
