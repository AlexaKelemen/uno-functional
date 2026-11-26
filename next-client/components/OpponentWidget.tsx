import './OpponentWidget.css'

type OpponentWidgetProps = Readonly<{
    name: string
    handSize: number
    isTurn: boolean
    canAccuse?: boolean
    onAccuse: () => void
}>

export default function OpponentWidget({name, handSize, isTurn, canAccuse = false, onAccuse}: OpponentWidgetProps){
    return(
      <div className={`opponentWidgetContainer ${isTurn ? 'active' : ''}`}>
        <div className='cards'>
            {Array.from({ length: handSize }, (_, i) => (
            <div key={i} className="card">
                <div className="ovalContainer">UNO</div>
            </div>
            ))}
        </div>
        <div className='opponentInfo'>
            <span className='opponentName'>{name}</span>
            <span className="opponentHandSize">{handSize} {handSize === 1 ? 'card' : 'cards' }</span>
            {canAccuse && (
                <button className="accuseBtn" onClick={onAccuse}>
                    Didn't say Uno!
                </button>
            )}
        </div>

      </div>  
    )
}