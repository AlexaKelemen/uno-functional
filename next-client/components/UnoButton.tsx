import './UnoButton.css'

type UnoButtonProps = Readonly<{
    sayUnoActive: boolean
    isTurn: boolean
    onToggle: () => void
}>

export default function UnoButton({sayUnoActive, isTurn, onToggle}: UnoButtonProps){
    return(
        <button
        type="button"
        className={`unoButton ${sayUnoActive ? 'activated' : ''}`}
        disabled={!isTurn}
        onClick={onToggle}
        >
            <span className="unoText">UNO!</span>
        </button>
    )
}