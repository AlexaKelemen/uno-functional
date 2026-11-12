// What the components read from the state. Both kinds of game are turned into
// the same PlayerView, so one set of game components can show either.
import { createSelector } from '@reduxjs/toolkit'
import type { Card, Color } from '@model/deck'
import * as Round from '@model/round'
import type { OnlineGame } from '../api/gameServer'
import type { RootState } from './store'
import { HUMAN, type RoundState } from './slices/localGameSlice'

export type PlayDirection = 'clockwise' | 'counterclockwise'

// What one player is allowed to see: their own hand plus public information
export type PlayerView = Readonly<{
  playerIndex: number
  playerNames: readonly string[]
  handSizes: readonly number[]
  playerInTurn: number | undefined
  direction: PlayDirection
  drawPileSize: number
  hand: readonly Card[]
  topCard: Card
  currentColor: Color
}>

// ---------- Session ----------

export const selectPlayerName = (state: RootState) => state.session.playerName
export const selectIsLoggedIn = (state: RootState) => state.session.playerName !== undefined

// ---------- Lobby ----------

export const selectPendingGames = (state: RootState) => state.lobby.pendingGames
export const selectLobbyError = (state: RootState) => state.lobby.error

export const selectWaitingIn = (state: RootState) =>
  state.lobby.pendingGames.find((game) => game.id === state.lobby.waitingForId)

// The game we waited in has started: time to go to it
export const selectStartedGameId = (state: RootState) => {
  const id = state.lobby.waitingForId
  return id !== undefined && state.onlineGames.games[id] !== undefined ? id : undefined
}

// ---------- Local game (functional model) ----------

export function roundView(round: RoundState, playerIndex: number): PlayerView {
  // The model's queries only read the round, so they don't need the shuffler
  const asRound = round as Round.Round
  return {
    playerIndex,
    playerNames: round.players,
    handSizes: round.hands.map((hand) => hand.length),
    playerInTurn: round.playerInTurn,
    direction: round.direction === 1 ? 'clockwise' : 'counterclockwise',
    drawPileSize: round.drawPile.length,
    hand: round.hands[playerIndex],
    topCard: Round.topOfDiscard(asRound),
    currentColor: round.currentColor,
  }
}

export const selectLocalRound = (state: RootState) => state.localGame.round

// Seen from the human's seat. Memoized, so components only re-render when the round changes.
export const selectLocalView = createSelector([selectLocalRound], (round) =>
  round === undefined ? undefined : roundView(round, HUMAN),
)

// Same view for any seat - the bots use this
export const selectLocalViewFor = (state: RootState, playerIndex: number) =>
  state.localGame.round && roundView(state.localGame.round, playerIndex)

export const selectLocalWinner = (state: RootState) =>
  state.localGame.round && Round.winner(state.localGame.round as Round.Round)

export const selectLocalScore = (state: RootState) =>
  state.localGame.round && Round.score(state.localGame.round as Round.Round)

export const selectIsHumansTurn = (state: RootState) => state.localGame.round?.playerInTurn === HUMAN

// Can the player in turn play this card? Handy for greying out cards.
export const selectCanPlay = (state: RootState, cardIndex: number) =>
  state.localGame.round !== undefined && Round.canPlay(cardIndex, state.localGame.round as Round.Round)

export const selectBotsThinking = (state: RootState) => state.localGame.botsThinking
export const selectLastAccusation = (state: RootState) => state.localGame.lastAccusation
export const selectLocalError = (state: RootState) => state.localGame.error

// ---------- Online games ----------

export function onlineView(game: OnlineGame, me: string): PlayerView {
  return {
    playerIndex: game.players.indexOf(me),
    playerNames: game.players,
    handSizes: game.handSizes,
    playerInTurn: game.playerInTurn ?? undefined,
    direction: game.direction as PlayDirection,
    drawPileSize: game.drawPileSize,
    hand: game.hand ?? [],
    topCard: game.topCard,
    currentColor: game.currentColor,
  }
}

export const selectOnlineGame = (state: RootState, id: string) => state.onlineGames.games[id]

export const selectOnlineView = createSelector(
  [(state: RootState, id: string) => state.onlineGames.games[id], selectPlayerName],
  (game, me): PlayerView | undefined => (game && me ? onlineView(game, me) : undefined),
)

export const selectOnlineWinner = (state: RootState, id: string) =>
  state.onlineGames.games[id]?.winner ?? undefined

export const selectOnlineError = (state: RootState) => state.onlineGames.error
