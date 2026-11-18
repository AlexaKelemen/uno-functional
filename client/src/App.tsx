import { Routes, Route } from 'react-router'
import SetupView from './views/SetupView'
import LobbyView from './views/LobbyView'
import GameView from './views/GameView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SetupView />} />
      <Route path="/lobby" element={<LobbyView />} />
      <Route path="/game" element={<GameView />} />
      <Route path="/game/:gameId" element={<GameView />} />
    </Routes>
  )
}
