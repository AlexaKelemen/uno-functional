import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { selectLobbyError, selectPlayerName, selectStartedGameId, selectWaitingIn } from '@/redux/selectors'
import { leaveGame, startGameNow } from '@/redux/thunks/lobby'
import { stoppedWaiting } from '@/redux/slices/lobbySlice'
import uno_logo from '../../assets/UNO_Logo.svg'
import './LobbyView.css'

export default function LobbyView() {

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const lobbyRoom = useAppSelector(selectWaitingIn)
  const me = useAppSelector(selectPlayerName)
  const error = useAppSelector(selectLobbyError)
  const startedGameId = useAppSelector(selectStartedGameId)

  useEffect(() => {
    if (startedGameId === undefined) return
    dispatch(stoppedWaiting())
    navigate(`/game/${startedGameId}`)
  }, [startedGameId, dispatch, navigate])

  const leave = async () => {
    await dispatch(leaveGame())
    navigate('/')
  }

  if (!lobbyRoom) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    )
  }

  const isCreator = lobbyRoom.creator === me
  const isEnoughPlayers = lobbyRoom.players.length >= 2
  const infoText = !isCreator
    ? 'Waiting for the host to start the game…'
    : isEnoughPlayers ? 'You can start the game!' : 'Waiting for more players to join…'

  return (
    <main className="lobbyPageContainer">
      <section className="topBarLobby">
        <button className="quitButton" onClick={() => void leave()}>Leave</button>
        <img id="uno-logo" src={uno_logo} alt="UNO Logo" />
      </section>

      <span className="lobbyTitle">{lobbyRoom.creator}'s lobby</span>

      <div className="lobbyContainer">
        <span className="setupLabel" id="joinCode">Join code: {lobbyRoom.id}</span>
        <span className="setupLabel">
          {lobbyRoom.players.length} / {lobbyRoom.numberOfPlayers} players
        </span>

        <ul className="playerList">
          {lobbyRoom.players.map((player) => (
            <li key={player} className="playerRow">
              <span className="playerName">
                {player === lobbyRoom.creator && <span className="crown">👑</span>}
                {player}
              </span>
              {player === me && <span className="youTag">(You)</span>}
            </li>
          ))}
        </ul>

        <p className="infoLabel">{infoText}</p>
        <button
          className="startButton"
          disabled={!isCreator || !isEnoughPlayers}
          onClick={() => void dispatch(startGameNow())}
        >
          Start Game
        </button>
        {error && <p className="errorLabel">Error: {error}</p>}
      </div>
    </main>
  )

}