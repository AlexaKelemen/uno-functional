import type { Color } from '@model/deck'
import './ColorWheelWidget.css'

type ColorWheelProps = Readonly<{
    currentColor?: Color
    selectable?: boolean
    onSelectColor?: (color: Color) => void
}>
const quarters: readonly Color[] = ['YELLOW', 'RED', 'GREEN', 'BLUE']

export default function ColorWheelWidget({ currentColor, selectable = false, onSelectColor }: ColorWheelProps) {
    return (
        <div className="colorWheel">
            {quarters.map((color) => {
                const classes = [
                    'quarter',
                    color.toLowerCase(),
                    (selectable || color === currentColor) && 'active',
                    selectable && 'selectable',
                ].filter(Boolean).join(' ')

                return (
                    <div
                        key={color}
                        className={classes}
                        onClick={() => selectable && onSelectColor?.(color)}
                    />
                )
            })}
        </div>
    )
}




