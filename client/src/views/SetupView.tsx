import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { selectLobbyError } from '@/redux/selectors'
import { login } from '@/redux/thunks/session'
import { createGame, joinGame } from '@/redux/thunks/lobby'
import { startLocalGame } from '@/redux/thunks/localGame'
import type { GameSetup } from '@/redux/slices/localGameSlice'
import uno_logo from '../../assets/UNO_Logo.svg'
import './SetupView.css'

type GameMode = 'singleplayer' | 'multiplayer'
type MultiOption = 'createLobby' | 'joinLobby'

export default function SetupView() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [playerName, setPlayerName] = useState('')
  const [botCount, setBotCount] = useState<GameSetup['botCount']>(3)
  const [gameMode, setGameMode] = useState<GameMode>('singleplayer')
  const [multiOption, setMultiOption] = useState<MultiOption>('createLobby')
  const [numberOfPlayers, setNumberOfPlayers] = useState(2)
  const [joinCode, setJoinCode] = useState('')

  const name = playerName.trim()
  const canStart = name.length > 0 && (gameMode === 'singleplayer' || multiOption === 'createLobby' || joinCode.trim() !== '')
  const startLabel =
    gameMode === 'singleplayer' ? 'Start game'
      : multiOption === 'createLobby' ? 'Create lobby'
        : 'Join lobby'
  const lobbyError = useAppSelector(selectLobbyError)
  const waitingForId = useAppSelector((state) => state.lobby.waitingForId)

  useEffect(() => {
    if (waitingForId !== undefined) navigate('/lobby')
  }, [waitingForId, navigate])

  const start = () => {
    if (gameMode === 'singleplayer') {
      void dispatch(startLocalGame({ playerName: name, botCount }))
      navigate('/game')
      return
    }
    dispatch(login(name))
    if (multiOption === 'createLobby') void dispatch(createGame(numberOfPlayers))
    else void dispatch(joinGame(joinCode.trim()))
  }

  return (
    <main className="setupPageContainer">
      <img id="uno-logo" src={uno_logo} alt="UNO Logo" />

      <div className="modeToggle">
        <input type="radio" name="mode" id="singleplayer" checked={gameMode === 'singleplayer'} onChange={() => setGameMode('singleplayer')} />
        <label htmlFor="singleplayer">Singleplayer</label>
        <input type="radio" name="mode" id="multiplayer" checked={gameMode === 'multiplayer'} onChange={() => setGameMode('multiplayer')} />
        <label htmlFor="multiplayer">Multiplayer</label>
      </div>

      <div className="setupContainer">
        <label className="setupLabel" htmlFor="playerName">Your name:</label>
        <input id="playerName" className="setupInput" maxLength={20} placeholder="Enter your name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
        {gameMode === 'singleplayer' ? (
          <>
            <span className="setupLabel">Number of bots:</span>
            <div className="choiceBtns">
              {([1, 2, 3] as const).map((n) => (
                <span key={n}>
                  <input type="radio" name="bots" id={`b${n}`}
                    checked={botCount === n} onChange={() => setBotCount(n)} />
                  <label htmlFor={`b${n}`}>{n}</label>
                </span>
              ))}
            </div>
            <p className="infoLabel">There are {botCount + 1} players at the table</p>
          </>
        ) : (
          <>
            <span className="setupLabel">Game options:</span>
            <div className="choiceBtns">
                <input type="radio" name="gameOptions" id="createLobby" checked={multiOption === 'createLobby'} onChange={() => setMultiOption('createLobby')} />
                <label htmlFor="createLobby">Create Lobby</label>
                <input type="radio" name="gameOptions" id="joinLobby" checked={multiOption === 'joinLobby'} onChange={() => setMultiOption('joinLobby')} />
                <label htmlFor="joinLobby">Join Lobby</label>
            </div>

            {multiOption === 'createLobby' ? (
              <>
                <span className="setupLabel">Number of players (including you):</span>
                <div className="choiceBtns">
                  {[2, 3, 4].map((n) => (
                    <span key={n}>
                      <input type="radio" name="numberOfPlayers" id={`p${n}`} checked={numberOfPlayers === n} onChange={() => setNumberOfPlayers(n)} />
                      <label htmlFor={`p${n}`}>{n}</label>
                    </span>
                  ))}
                </div>
                <p className="infoLabel">You will be the host of the game</p>
              </>
            ) : (
              <>
                <label className="setupLabel" htmlFor="joinCode">Join Code:</label>
                <input id="joinCode" className="setupInput" placeholder="Enter join code for the lobby" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                <p className="infoLabel">You will join someone else's game</p>
              </>
            )}
          </>
        )}

        <button className="startButton" disabled={!canStart} onClick={start}>{startLabel}</button>
        {gameMode === 'multiplayer' && lobbyError && <p className="errorLabel">Error: {lobbyError}</p>}
      </div>
    </main>
  )
}