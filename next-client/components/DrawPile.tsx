import './DrawPile.css'

type DrawPileProps = Readonly<{
    isTurn: boolean
    onDraw: () => void
}>

export default function DrawPile({isTurn, onDraw}: DrawPileProps){
    return(
        <div className={`card drawPile ${isTurn ? 'active' : ''}`} onClick={onDraw}>
            <div className='ovalContainer'>UNO</div>
        </div>
    )
}
