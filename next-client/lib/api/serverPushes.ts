// The server's pushes as RxJS Observables. Subscribing registers a listener on
// the server; unsubscribing removes it again.
import { Observable } from 'rxjs'
import type { GameServer, OnlineGame, PendingGame } from './gameServer'

export const pendingGames$ = (server: GameServer): Observable<readonly PendingGame[]> =>
  new Observable((subscriber) => server.onPendingGames((games) => subscriber.next(games)))

export const gameUpdates$ = (server: GameServer): Observable<OnlineGame> =>
  new Observable((subscriber) => server.onGameUpdated((game) => subscriber.next(game)))
