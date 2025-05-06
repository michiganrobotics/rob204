class Device {
    constructor( gamepadIndex ) {
        this._gamepadIndex = gamepadIndex
        this._gamepad = navigator.getGamepads()[ this.gamepadIndex ]
    }

    get gamepadIndex() {
        return this._gamepadIndex
    }

    get gamepad() {
        this._gamepad = navigator.getGamepads()[ this.gamepadIndex ]
        return this._gamepad
    }
}

export class RotaryEncoder extends Device {
    constructor( gamepadIndex, clockwiseButtonIndex, counterclockwiseButtonIndex, topButtonIndex, axisIndex ) {
        super( gamepadIndex )
        this._axisIndex = axisIndex

        this._buttons = {
            "clockwise": new Button( gamepadIndex, clockwiseButtonIndex ),
            "counter-clockwise": new Button( gamepadIndex, counterclockwiseButtonIndex ),
            "button": new Button( gamepadIndex, topButtonIndex )
        }

        this._axis = new Axis( gamepadIndex, axisIndex )
        this._velocity = this._axis.value
        this._direction = 0
    }

    get buttons() {
        return this._buttons
    }

    get velocity() {
        this._velocity = this._axis.value
        return this._velocity
    }

    get direction() {
        let direction = 0
        if( this.buttons[ "clockwise" ].pressed ) direction = 1
        if ( this.buttons[ "counter-clockwise" ].pressed ) direction = -1

        return direction
    }
}

export class Button extends Device {
    constructor( gamepadIndex, buttonIndex ) {
        super( gamepadIndex )
        this._buttonIndex = buttonIndex
        this._pressed = false
    }

    get pressed() {
        const button = this.gamepad.buttons[ this._buttonIndex ]
        this._pressed = Button.ButtonPressed( button )
        return this._pressed
    }

    static ButtonPressed(b) {
        if (typeof b === "object") {
          return b.pressed
        }
        return b === 1.0
    }
}

export class Axis extends Device {
    constructor( gamepadIndex, axisIndex ) {
        super( gamepadIndex )
        this._axisIndex = axisIndex
        this._value = 0
        this._values = []
    }

    get value() {
        // take 20 sample moving average of value to smooth output
        const current_value = this.gamepad.axes[this._axisIndex]
        this._values.push( current_value )
        if(this._values.length > 20) this._values.shift()
        this._value = average( this._values )

        return this._value
    }
}

// credit: https://stackoverflow.com/a/41452260
const average = array => array.reduce((a, b) => a + b) / array.length;