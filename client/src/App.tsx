// Placeholder until the React views are ported from the Vue client.
// It only shows that the Redux store is wired in.
import { useAppSelector } from './redux/hooks'
import { selectPlayerName } from './redux/selectors'

export default function App() {
  const playerName = useAppSelector(selectPlayerName)
  return <h1>UNO {playerName ? `– ${playerName}` : ''}</h1>
}
