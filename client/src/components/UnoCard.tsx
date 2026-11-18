import type { Card } from '@model/deck'
import { isWild } from '@model/deck'
import './UnoCard.css'

type UnoCardProps = Readonly<{
    card: Card
    playable?: boolean
    isTopCard?: boolean
    onPlay?: () => void
}>

const colorClass = (card: Card): string =>
    'color' in card ? card.color.toLowerCase() : 'wild'

const symbol = (card: Card): string => {
    switch (card.type) {
        case 'NUMBERED': return String(card.number)
        case 'SKIP': return '⊘'
        case 'REVERSE': return '⇄'
        case 'DRAW': return '+2'
        case 'WILD DRAW': return '+4'
        case 'WILD': return ''
    }
}

export default function UnoCard({ card, playable = false, isTopCard = false, onPlay }: UnoCardProps) {
    return (
        <div className={`unoCard card ${colorClass(card)} ${isTopCard ? '' : playable ? 'playable' : 'disabled'}`} onClick={onPlay}>
            {isWild(card) ? (
                <>
                    <span className="cardSymbolTopCorner">{symbol(card)}</span>
                    <div className="ovalContainer wildOvalContainer" />
                    <span className="cardSymbolBottomCorner">{symbol(card)}</span>
                </>
            ) : (
                <>
                    <span className="cardSymbolTopCorner">{symbol(card)}</span>
                    <div className="ovalContainer">
                        <span className="cardSymbolMiddle">{symbol(card)}</span>
                    </div>
                    <span className="cardSymbolBottomCorner">{symbol(card)}</span>
                </>
            )}
        </div>
    )
}