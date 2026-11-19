import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isWild, type Color } from '@model/deck'
import { selectCanPlayCard } from '@/redux/selectors'
import { useGameSource } from '@/hooks/useGameSource'
import UnoCard from '@/components/UnoCard'
import OpponentWidget from '@/components/OpponentWidget'
import ColorWheelWidget from '@/components/ColorWheelWidget'
import DrawPile from '@/components/DrawPile'
import UnoButton from '@/components/UnoButton'
import uno_logo from '../../assets/UNO_Logo.svg'
import './GameView.css'

export default function GameView() {

  const navigate = useNavigate()
  const { view, mySeat, isMyTurn, winner, waitingText, error, play, draw, accuse, endLocalGame } = useGameSource()

  const [sayUno, setSayUno] = useState(false)
  const [pendingWild, setPendingWild] = useState<number>()
  const [message, setMessage] = useState('')

  // No game in progress view
  if (!view) {
    return (
      <main>
        <section className="noGameSection">
          <div className="noGameContainer">
            <p>No game in progress.</p>
            <Link to="/">Set up a game</Link>
          </div>
        </section>
      </main>
    )
  }

  const opponents = view.playerNames
    .map((name, i) => ({ i, name }))
    .filter(({ i }) => i !== mySeat)

  const status =
    winner !== undefined ? (winner === mySeat ? 'You won!' : `${view.playerNames[winner]} won`)
      : message || error || waitingText

  const playCard = async (index: number, color?: Color) => {
    setPendingWild(undefined)
    setMessage('')
    const uno = sayUno
    setSayUno(false)
    await play(index, color, uno)
  }

  const clickCard = (index: number) => {
    if (!selectCanPlayCard(view, index)) return
    if (isWild(view.hand[index])) setPendingWild(index)
    else void playCard(index)
  }

  const onAccuse = async (seat: number, name: string) => {
    setMessage((await accuse(seat)) ? `Caught ${name}! +4 cards.` : `${name} is safe.`)
  }

  const leave = () => {
    endLocalGame()
    navigate('/')
  }

  return (
    <main>
      <section className="topBar">
        <button className="quitButton" onClick={leave}>Quit</button>
        <img id="uno-logo" src={uno_logo} alt="UNO Logo" />
        <span className="directionLabel">
          {view.direction === 'clockwise' ? '↻ Clockwise' : '↺ Counter-clockwise'}
        </span>
      </section>

      <section className="opponents">
        {opponents.map((o) => (
          <OpponentWidget
            key={o.i}
            name={o.name}
            handSize={view.handSizes[o.i]}
            isTurn={view.playerInTurn === o.i}
            canAccuse={view.handSizes[o.i] === 1}
            onAccuse={() => void onAccuse(o.i, o.name)}
          />
        ))}
      </section>

      <section className="colorInfo">
        <span>Current color:</span>
        <div className="colorWheelStatus">
          <ColorWheelWidget currentColor={view.currentColor} />
        </div>
      </section>

      <section className="mainGameInfo">
        <div className="mainGameInfoContainers">
          <DrawPile isTurn={isMyTurn} onDraw={() => void draw()} />
          <span>Draw pile: {view.drawPileSize}</span>
        </div>
        <div className="mainGameInfoContainers">
          <UnoCard card={view.topCard} isTopCard />
          <span>Top Card</span>
        </div>
        <div className="mainGameInfoContainers">
          <UnoButton sayUnoActive={sayUno} isTurn={isMyTurn} onToggle={() => setSayUno((on) => !on)} />
          <span>Say Uno with this play</span>
        </div>
      </section>

      <section className="statusInfo">
        <span>{status}</span>
        {winner !== undefined && <button className="newGamebutton" onClick={leave}>New game</button>}
      </section>

      <section className="handSection">
        <span>Your hand {isMyTurn && <span>— your turn</span>}</span>

        {pendingWild !== undefined && (
          <div
            className="colorSelection"
            onClick={(e) => { if (e.target === e.currentTarget) setPendingWild(undefined) }}
          >
            <ColorWheelWidget selectable onSelectColor={(c) => void playCard(pendingWild, c)} />
          </div>
        )}

        <div className="handContainer">
          {view.hand.map((card, i) => (
            <UnoCard
              key={i}
              card={card}
              playable={selectCanPlayCard(view, i)}
              onPlay={() => clickCard(i)}
            />
          ))}
        </div>
      </section>
    </main>
  )

}