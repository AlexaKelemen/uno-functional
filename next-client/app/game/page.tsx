// "/game" - the local game against bots. Static: the game runs entirely in
// the browser (the functional model in Redux, bots in Web Workers), so the
// server has nothing to render but the empty shell.
import GameView from '@/components/views/GameView'

export default function LocalGamePage() {
  return <GameView />
}
