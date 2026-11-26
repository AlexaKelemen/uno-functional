'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks'
import { selectLobbyError, selectPlayerName, selectStartedGameId, selectWaitingIn } from '@/lib/redux/selectors'
import { leaveGame, startGameNow } from '@/lib/redux/thunks/lobby'
import { stoppedWaiting } from '@/lib/redux/slices/lobbySlice'
import './LobbyView.css'

export default function LobbyView() {

  const dispatch = useAppDispatch()
  const router = useRouter()

  const lobbyRoom = useAppSelector(selectWaitingIn)
  const me = useAppSelector(selectPlayerName)
  const error = useAppSelector(selectLobbyError)
  const startedGameId = useAppSelector(selectStartedGameId)

  useEffect(() => {
    if (startedGameId === undefined) return
    dispatch(stoppedWaiting())
    router.push(`/game/${startedGameId}`)
  }, [startedGameId, dispatch, router])

  const leave = async () => {
    await dispatch(leaveGame())
    router.push('/')
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
        <img id="uno-logo" src="/UNO_Logo.svg" alt="UNO Logo" />
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